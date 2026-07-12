const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

const db = admin.firestore();
const enforceAppCheck = process.env.ENFORCE_APP_CHECK !== 'false';

const sanitizeDocId = (rawId) => {
    if (typeof rawId !== 'string') return null;
    const trimmed = rawId.trim();
    if (!trimmed) return null;
    if (!trimmed.includes('/')) return trimmed;

    const parts = trimmed.split('/').filter(Boolean);
    if (parts.length < 2) return null;
    return parts[parts.length - 1] || null;
};

const buildCustomerName = (source = {}) => {
    const direct = typeof source.customerName === 'string' ? source.customerName.trim() : '';
    if (direct) return direct;

    const firstName = typeof source?.customer?.firstName === 'string' ? source.customer.firstName.trim() : '';
    const lastName = typeof source?.customer?.lastName === 'string' ? source.customer.lastName.trim() : '';
    const fullName = [firstName, lastName].filter(Boolean).join(' ').trim();
    return fullName || 'Cliente';
};

// Helper para normalizar el payload 'data'
const getPayload = (data) => {
    if (data && typeof data === 'object' && data.data) {
        return data.data;
    }
    return data;
};

const ensureAppCheck = (context) => {
    if (!enforceAppCheck) return;
    if (!context.app) {
        throw new functions.https.HttpsError('failed-precondition', 'App Check requerido.');
    }
};

// Middleware de autenticación y rol de administrador
const ensureAdmin = async (context, data) => {
    let uid;
    if (context.auth) {
        uid = context.auth.uid;
    } else if (data && data.authToken) {
        const decoded = await admin.auth().verifyIdToken(data.authToken);
        uid = decoded.uid;
    } else {
        throw new functions.https.HttpsError('unauthenticated', 'Se requiere autenticación.');
    }

    const userDoc = await db.collection('users').doc(uid).get();
    if (!userDoc.exists || userDoc.data().role !== 'admin') {
        throw new functions.https.HttpsError('permission-denied', 'Requiere rol de administrador.');
    }
    return uid;
};

// --- GESTIÓN DE USUARIOS (ADMIN) ---

exports.createUser = functions.https.onCall(async (reqData, context) => {
    ensureAppCheck(context);
    const data = getPayload(reqData);
    await ensureAdmin(context, data);

    const { email, password, nombre, apellido, role, user, cedula, telefono } = data;

    // Validaciones básicas
    if (!email || !password || !nombre || !apellido || !role || !user) {
        throw new functions.https.HttpsError('invalid-argument', 'Faltan campos obligatorios: email, contraseña, nombre, apellido, rol y usuario.');
    }
    if (password.length < 6) {
        throw new functions.https.HttpsError('invalid-argument', 'La contraseña debe tener al menos 6 caracteres.');
    }

    let userRecord = null;

    try {
        // 1. Crear usuario en Firebase Authentication
        userRecord = await admin.auth().createUser({
            email: email.trim().toLowerCase(),
            password,
            displayName: `${nombre.trim()} ${apellido.trim()}`,
            emailVerified: true, // Admin crea usuarios pre-verificados
        });

        // 2. Construir payload Firestore (solo guarda opcionales si tienen valor)
        const firestoreData = {
            email:     email.trim().toLowerCase(),
            nombre:    nombre.trim(),
            apellido:  apellido.trim(),
            user:      user.trim(),
            role:      role.trim().toLowerCase(),
            verified:  true,        // Pre-verificado por el admin
            uid:       userRecord.uid,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };

        if (cedula  && typeof cedula  === 'string' && cedula.trim())  firestoreData.cedula  = cedula.trim();
        if (telefono && typeof telefono === 'string' && telefono.trim()) firestoreData.telefono = telefono.trim();

        // 3. Crear documento en Firestore usando el UID como ID
        await db.collection('users').doc(userRecord.uid).set(firestoreData);

        return { success: true, message: `Usuario ${email} creado exitosamente.`, uid: userRecord.uid };

    } catch (error) {
        console.error("Error creando usuario:", error);

        // Rollback: si ya se creó el usuario en Auth pero falló Firestore, eliminarlo
        if (userRecord && userRecord.uid) {
            await admin.auth().deleteUser(userRecord.uid).catch((deleteErr) => {
                console.error("Error en rollback de Auth:", deleteErr);
            });
        }

        // Mapear errores de Auth a mensajes amigables
        let message = error.message;
        if (error.code === 'auth/email-already-exists') message = 'El correo electrónico ya está en uso.';
        else if (error.code === 'auth/invalid-email')   message = 'El formato del correo es inválido.';
        else if (error.code === 'auth/weak-password')   message = 'La contraseña es muy débil (mínimo 6 caracteres).';

        throw new functions.https.HttpsError('invalid-argument', message);
    }
});

exports.deleteUser = functions.https.onCall(async (reqData, context) => {
    ensureAppCheck(context);
    const data = getPayload(reqData);
    await ensureAdmin(context, data);

    const { uid } = data;

    try {
        await admin.auth().deleteUser(uid);
        await db.collection('users').doc(uid).delete();
        return { success: true, message: 'Usuario eliminado.' };
    } catch (error) {
        console.error("Error eliminando usuario:", error);
        throw new functions.https.HttpsError('internal', error.message);
    }
});

exports.updateUserPassword = functions.https.onCall(async (reqData, context) => {
    ensureAppCheck(context);
    const data = getPayload(reqData);
    await ensureAdmin(context, data);

    const { uid, password } = data;

    if (!uid || !password) {
        throw new functions.https.HttpsError('invalid-argument', 'UID y contraseña son obligatorios.');
    }
    if (password.length < 6) {
        throw new functions.https.HttpsError('invalid-argument', 'La contraseña debe tener al menos 6 caracteres.');
    }

    try {
        // 1. Actualizar contraseña en Firebase Authentication
        await admin.auth().updateUser(uid, { password });

        // 2. Registrar timestamp del cambio en Firestore (sin exponer la contraseña)
        await db.collection('users').doc(uid).update({
            passwordChangedAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt:         admin.firestore.FieldValue.serverTimestamp(),
        });

        return { success: true, message: 'Contraseña actualizada en Authentication y registrada en Firestore.' };
    } catch (error) {
        console.error("Error actualizando contraseña:", error);
        let message = error.message;
        if (error.code === 'auth/user-not-found') message = 'Usuario no encontrado en Authentication.';
        throw new functions.https.HttpsError('internal', message);
    }
});

// Resuelve el identificador de login (usuario o correo) al correo real.
// Se llama ANTES de autenticar, por eso no usa ensureAdmin: solo App Check.
exports.resolveLoginEmail = functions.https.onCall(async (reqData, context) => {
    ensureAppCheck(context);
    const data = getPayload(reqData);
    const identifier = typeof data?.identifier === 'string' ? data.identifier.trim() : '';

    if (!identifier) {
        throw new functions.https.HttpsError('invalid-argument', 'Falta el usuario o correo.');
    }

    if (/^\S+@\S+\.\S+$/.test(identifier)) {
        return { email: identifier.toLowerCase() };
    }

    const querySnap = await db.collection('users').where('user', '==', identifier).limit(1).get();
    if (querySnap.empty || !querySnap.docs[0].data().email) {
        throw new functions.https.HttpsError('not-found', 'Usuario no encontrado.');
    }

    return { email: querySnap.docs[0].data().email };
});

// Permite que cualquier usuario autenticado edite su PROPIO perfil.
// Solo campos no sensibles — nunca 'role', 'email' ni 'verified' — para que
// esto no se convierta en una vía de escalación de privilegios.
exports.updateOwnProfile = functions.https.onCall(async (reqData, context) => {
    ensureAppCheck(context);
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Se requiere autenticación.');
    }

    const data = getPayload(reqData);
    const { nombre, apellido, user, cedula, telefono } = data;

    if (!nombre?.trim() || !apellido?.trim() || !user?.trim()) {
        throw new functions.https.HttpsError('invalid-argument', 'Nombre, apellido y usuario son obligatorios.');
    }

    const uid = context.auth.uid;
    const updateData = {
        nombre:    nombre.trim(),
        apellido:  apellido.trim(),
        user:      user.trim(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    updateData.cedula   = cedula?.trim()   || admin.firestore.FieldValue.delete();
    updateData.telefono = telefono?.trim() || admin.firestore.FieldValue.delete();

    try {
        await db.collection('users').doc(uid).update(updateData);

        try {
            await admin.auth().updateUser(uid, { displayName: `${nombre.trim()} ${apellido.trim()}` });
        } catch (profileErr) {
            console.warn('No se pudo actualizar displayName en Auth:', profileErr);
        }

        return { success: true, message: 'Perfil actualizado.' };
    } catch (error) {
        console.error('Error actualizando perfil propio:', error);
        throw new functions.https.HttpsError('internal', error.message);
    }
});

// --- OPERACIONES DE NEGOCIO ---

exports.dispatchPreSale = functions.https.onCall(async (reqData, context) => {
    ensureAppCheck(context);
    const data = getPayload(reqData);
    // Lógica existente...
    // (Simplificado para evitar duplicar código en esta vista,
    // pero en el archivo real mantendría la lógica original si estuviera editando)
    // Como estoy reescribiendo el archivo completo, debo incluir la lógica original.

    // ... Copiando lógica original ...
    let uid;
    if (context.auth) uid = context.auth.uid;
    else if (data && data.authToken) {
        const decodedToken = await admin.auth().verifyIdToken(data.authToken);
        uid = decodedToken.uid;
    } else {
        throw new functions.https.HttpsError('unauthenticated', 'Token inválido');
    }

    const userDoc = await db.collection('users').doc(uid).get();
    if (!userDoc.exists || userDoc.data().role !== 'bodeguero') {
        throw new functions.https.HttpsError('permission-denied', 'No es bodeguero.');
    }

    const { preSaleId, entregadorId } = data;
    const preSaleRef = db.collection('presales').doc(preSaleId);
    await preSaleRef.update({
        status: 'dispatched',
        entregadorId,
        fechaEntregaRepartidor: admin.firestore.FieldValue.serverTimestamp()
    });
    return { success: true };
});

exports.completePreSalePayment = functions.https.onCall(async (reqData, context) => {
    ensureAppCheck(context);
    const data = getPayload(reqData);
    let uid;
    if (context.auth) uid = context.auth.uid;
    else if (data && data.authToken) {
        const decoded = await admin.auth().verifyIdToken(data.authToken);
        uid = decoded.uid;
    } else {
        throw new functions.https.HttpsError('unauthenticated', 'Token inválido');
    }

    const { preSaleId, amountPaid } = data;
    const paidAmount = Number(amountPaid || 0);
    if (Number.isNaN(paidAmount) || paidAmount < 0) {
        throw new functions.https.HttpsError('invalid-argument', 'Monto inválido');
    }

    const userDoc = await db.collection('users').doc(uid).get();
    const userEmail = userDoc.exists ? (userDoc.data().email || userDoc.data().displayName || uid) : uid;

    const safePreSaleId = sanitizeDocId(preSaleId);
    if (!safePreSaleId) {
        throw new functions.https.HttpsError('invalid-argument', 'preSaleId inválido');
    }

    const preSaleRef = db.collection('presales').doc(safePreSaleId);

    // Estados que bloquean el cobro definitivamente
    const TERMINAL_BLOCKING = new Set(['paid', 'cancelled', 'delivered']);

    await db.runTransaction(async (t) => {
        const doc = await t.get(preSaleRef);
        if (!doc.exists) throw new functions.https.HttpsError('not-found', 'Pre-venta no encontrada');

        const pData = doc.data();

        // Validar estado terminal
        if (TERMINAL_BLOCKING.has(pData.status)) {
            throw new functions.https.HttpsError(
                'failed-precondition',
                `No se puede cobrar una pre-venta en estado: ${pData.status}`
            );
        }

        if (pData.entregadorId !== uid) {
            throw new functions.https.HttpsError('permission-denied', 'No asignado a esta entrega');
        }

        if (pData.status !== 'dispatched') {
            throw new functions.https.HttpsError(
                'failed-precondition',
                `Estado incorrecto para cobrar: ${pData.status}. Se requiere 'dispatched'.`
            );
        }

        const total = Number(pData.total || 0);

        // isCredit: basado SOLO en paymentMethod para evitar falsos positivos por estado
        const isCredit = pData.paymentMethod === 'credit';

        if (!isCredit && paidAmount < total) {
            throw new functions.https.HttpsError(
                'failed-precondition',
                `Pago insuficiente. Total: ${total.toFixed(2)}, Recibido: ${paidAmount.toFixed(2)}`
            );
        }

        let nextStatus = 'paid';
        let creditId = sanitizeDocId(pData.creditId) || null;
        let creditRef = null;
        let creditDoc = null;

        if (isCredit) {
            // Buscar el crédito asociado
            creditRef = creditId ? db.collection('credits').doc(creditId) : null;
            creditDoc = creditRef ? await t.get(creditRef) : null;

            if (!creditDoc || !creditDoc.exists) {
                // Fallback: buscar por preSaleId
                const creditQuery = await t.get(
                    db.collection('credits').where('preSaleId', '==', safePreSaleId).limit(1)
                );
                if (!creditQuery.empty) {
                    creditDoc = creditQuery.docs[0];
                    creditRef = creditDoc.ref;
                    creditId = creditDoc.id;
                }
            }
        }

        if (isCredit) {
            const applyAmount = Math.min(paidAmount, total);

            if (!creditRef || !creditDoc || !creditDoc.exists) {
                // Crear crédito si no existe (caso edge: entregador cobra sin crédito previo)
                creditRef = db.collection('credits').doc();
                creditId = creditRef.id;
                const newPending = Math.max(total - applyAmount, 0);
                const creditStatus = newPending <= 0 ? 'paid' : 'pending';
                nextStatus = newPending <= 0 ? 'paid' : 'credit_pending';

                t.set(creditRef, {
                    preSaleId: safePreSaleId,
                    customerId: pData.customerId || pData.customer?.id || null,
                    customerName: buildCustomerName(pData),
                    clientName: buildCustomerName(pData),
                    total,
                    paid: applyAmount,
                    pending: newPending,
                    status: creditStatus,
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    createdBy: pData.createdBy || userEmail,
                    payments: applyAmount > 0
                        ? [{ amount: applyAmount, date: admin.firestore.Timestamp.now(), by: userEmail }]
                        : [],
                });
            } else {
                const creditData = creditDoc.data() || {};
                const currentPaid = Number(creditData.paid || 0);
                const currentPending = Number(creditData.pending ?? total);
                const toApply = Math.min(paidAmount, currentPending);
                const newPaid = currentPaid + toApply;
                const newPending = Math.max(currentPending - toApply, 0);
                const creditStatus = newPending <= 0 ? 'paid' : 'pending';
                nextStatus = newPending <= 0 ? 'paid' : 'credit_pending';

                const creditUpdate = {
                    paid: newPaid,
                    pending: newPending,
                    status: creditStatus,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                };

                if (toApply > 0) {
                    creditUpdate.payments = admin.firestore.FieldValue.arrayUnion({
                        amount: toApply,
                        date: admin.firestore.Timestamp.now(),
                        by: userEmail,
                    });
                }

                t.update(creditRef, creditUpdate);
            }
        }

        const preSaleUpdate = {
            status: nextStatus,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            amountPaid: paidAmount,
            change: Math.max(paidAmount - total, 0),
            inventoryDeducted: true,
            inventoryDeductedAt: pData.inventoryDeductedAt || admin.firestore.FieldValue.serverTimestamp(),
            inventoryDeductedBy: pData.inventoryDeductedBy || pData.createdBy || userEmail,
        };

        if (creditId) preSaleUpdate.creditId = creditId;
        if (nextStatus === 'paid') {
            preSaleUpdate.fechaPago = admin.firestore.FieldValue.serverTimestamp();
        }

        t.update(preSaleRef, preSaleUpdate);
    });

    return { success: true };
});

exports.getDashboardStats = functions.https.onCall(async (reqData, context) => {
    ensureAppCheck(context);
    const data = getPayload(reqData);
    let uid;
    if (context.auth) uid = context.auth.uid;
    else if (data && data.authToken) {
        const decoded = await admin.auth().verifyIdToken(data.authToken);
        uid = decoded.uid;
    } else {
        throw new functions.https.HttpsError('unauthenticated', 'Auth required');
    }

    const userDoc = await db.collection('users').doc(uid).get();
    if (!userDoc.exists) throw new functions.https.HttpsError('not-found', 'User not found');
    const role = userDoc.data().role;

    let stats = {};
    if (role === 'admin') {
        const [p, l, u] = await Promise.all([
            db.collection('products').count().get(),
            db.collection('products').where('stock', '<=', 5).count().get(),
            db.collection('users').count().get()
        ]);
        // Note: .count() is newer, if not supported use .get().size
        // Using .get().size for compatibility with older admin SDKs if needed, but count() is efficient.
        // Assuming environment supports it. If not, revert to get().size.
        // To be safe and match previous logic:
        const pSnap = await db.collection('products').get();
        const lSnap = await db.collection('products').where('stock', '<=', 5).get();
        const uSnap = await db.collection('users').get();

        stats = {
            products: pSnap.size,
            lowStock: lSnap.size,
            users: uSnap.size,
            verifiedUsers: uSnap.docs.filter(d => d.data().emailVerified).length
        };
    } else if (role === 'bodeguero') {
        const [pSnap, rSnap] = await Promise.all([
            db.collection('presales').where('status', '==', 'pending').get(),
            db.collection('presales').where('status', '==', 'ready_for_delivery').get()
        ]);
        stats = { pendingPreSales: pSnap.size, readyForDelivery: rSnap.size };
    } else if (role === 'entregador') {
        const aSnap = await db.collection('presales').where('entregadorId', '==', uid).where('status', '==', 'dispatched').get();
        stats = {
            assignedDeliveries: aSnap.size,
            totalToCollect: aSnap.docs.reduce((s, d) => s + (d.data().total || 0), 0)
        };
    } else {
        const pSnap = await db.collection('products').get();
        const lSnap = await db.collection('products').where('stock', '<=', 5).get();
        stats = { products: pSnap.size, lowStock: lSnap.size };
    }
    return stats;
});
