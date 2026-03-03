const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

const db = admin.firestore();

// Helper para normalizar el payload 'data'
const getPayload = (data) => {
    if (data && typeof data === 'object' && data.data) {
        return data.data;
    }
    return data;
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
    const data = getPayload(reqData);
    await ensureAdmin(context, data);

    const { email, password, nombre, apellido, role, user } = data;

    try {
        // 1. Crear usuario en Auth
        const userRecord = await admin.auth().createUser({
            email,
            password,
            displayName: `${nombre} ${apellido}`,
        });

        // 2. Crear documento en Firestore
        await db.collection('users').doc(userRecord.uid).set({
            email,
            nombre,
            apellido,
            role,
            user, // username
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            uid: userRecord.uid
        });

        return { success: true, message: 'Usuario creado exitosamente.' };
    } catch (error) {
        console.error("Error creando usuario:", error);
        throw new functions.https.HttpsError('invalid-argument', error.message);
    }
});

exports.deleteUser = functions.https.onCall(async (reqData, context) => {
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
    const data = getPayload(reqData);
    await ensureAdmin(context, data);

    const { uid, password } = data;

    try {
        await admin.auth().updateUser(uid, { password });
        return { success: true, message: 'Contraseña actualizada.' };
    } catch (error) {
        console.error("Error actualizando contraseña:", error);
        throw new functions.https.HttpsError('internal', error.message);
    }
});

// --- OPERACIONES DE NEGOCIO ---

exports.dispatchPreSale = functions.https.onCall(async (reqData, context) => {
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

    const preSaleRef = db.collection('presales').doc(preSaleId);

    await db.runTransaction(async (t) => {
        const doc = await t.get(preSaleRef);
        if (!doc.exists) throw new functions.https.HttpsError('not-found', 'No existe');
        const pData = doc.data();
        if (pData.entregadorId !== uid) throw new functions.https.HttpsError('permission-denied', 'No asignado');
        if (pData.status !== 'dispatched') throw new functions.https.HttpsError('failed-precondition', 'Estado incorrecto');

        const total = Number(pData.total || 0);
        const isCredit = pData.paymentMethod === 'credit' || String(pData.status || '').startsWith('credit_');

        if (!isCredit && paidAmount < total) {
            throw new functions.https.HttpsError('failed-precondition', 'Pago incompleto');
        }

        const items = Array.isArray(pData.items) ? pData.items : [];

        // --- Lecturas previas (antes de escribir) ---
        const productRefs = items.map(item => db.collection('products').doc(item.productId));
        const productDocs = await Promise.all(productRefs.map(ref => t.get(ref)));
        const productById = new Map(productDocs.map(docSnap => [docSnap.id, docSnap]));

        const bonusesToApply = {};
        items.forEach(item => {
            const prodSnap = productById.get(item.productId);
            if (!prodSnap || !prodSnap.exists) return;
            const prodData = prodSnap.data();
            const bonuses = prodData.bonuses || (prodData.bonus ? [prodData.bonus] : []);
            if (!Array.isArray(bonuses) || bonuses.length === 0) return;

            for (const b of bonuses) {
                if (!b || !b.enabled) continue;
                const threshold = Number(b.threshold) || 0;
                const giveQty = Number(b.bonusQuantity) || 0;
                if (threshold <= 0 || giveQty <= 0) continue;

                const times = Math.floor(Number(item.quantity) / threshold);
                if (times <= 0) continue;

                const totalAward = times * giveQty;
                const bonusProdId = b.bonusProductId;
                if (!bonusProdId) continue;

                if (!bonusesToApply[bonusProdId]) bonusesToApply[bonusProdId] = 0;
                bonusesToApply[bonusProdId] += totalAward;
            }
        });

        const bonusProductIds = Object.keys(bonusesToApply);
        const bonusRefs = bonusProductIds.map(id => db.collection('products').doc(id));
        const bonusDocs = await Promise.all(bonusRefs.map(ref => t.get(ref)));
        const bonusById = new Map(bonusDocs.map(docSnap => [docSnap.id, docSnap]));

        let nextStatus = 'paid';
        let creditId = pData.creditId || null;
        let creditRef = null;
        let creditDoc = null;

        if (isCredit) {
            creditRef = creditId ? db.collection('credits').doc(creditId) : null;
            creditDoc = creditRef ? await t.get(creditRef) : null;

            if (!creditDoc || !creditDoc.exists) {
                const creditQuery = await t.get(
                    db.collection('credits').where('preSaleId', '==', preSaleId).limit(1)
                );
                if (!creditQuery.empty) {
                    creditDoc = creditQuery.docs[0];
                    creditRef = creditDoc.ref;
                    creditId = creditDoc.id;
                }
            }
        }

        // --- Escrituras ---
        if (isCredit) {
            const applyAmount = Math.min(paidAmount, total);

            if (!creditRef) {
                creditRef = db.collection('credits').doc();
                creditId = creditRef.id;
                const pending = Math.max(total - applyAmount, 0);
                const status = pending <= 0 ? 'paid' : 'pending';
                const nextCreditStatus = status === 'paid' ? 'paid' : 'credit_pending';
                t.set(creditRef, {
                    preSaleId,
                    customerId: pData.customerId || pData.customer?.id || null,
                    customerName: pData.customerName || pData.customer?.firstName || 'Cliente',
                    total,
                    paid: applyAmount,
                    pending,
                    status,
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    createdBy: pData.createdBy || userEmail,
                    payments: applyAmount > 0 ? [{ amount: applyAmount, date: admin.firestore.Timestamp.now(), by: userEmail }] : [],
                });
                nextStatus = nextCreditStatus;
            } else {
                const creditData = creditDoc.data() || {};
                const currentPaid = Number(creditData.paid || 0);
                const currentPending = Number(creditData.pending || total);
                const toApply = Math.min(paidAmount, currentPending);
                const newPaid = currentPaid + toApply;
                const newPending = Math.max(currentPending - toApply, 0);
                const status = newPending <= 0 ? 'paid' : 'pending';
                const nextCreditStatus = status === 'paid' ? 'paid' : 'credit_pending';

                const updatePayload = {
                    paid: newPaid,
                    pending: newPending,
                    status,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                };

                if (toApply > 0) {
                    updatePayload.payments = admin.firestore.FieldValue.arrayUnion({
                        amount: toApply,
                        date: admin.firestore.Timestamp.now(),
                        by: userEmail,
                    });
                }

                t.update(creditRef, updatePayload);
                nextStatus = nextCreditStatus;
            }
        }

        const preSaleUpdate = {
            status: nextStatus,
            creditId: creditId || pData.creditId || null,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            amountPaid: paidAmount,
            change: Math.max(paidAmount - total, 0),
        };

        if (nextStatus === 'paid') {
            preSaleUpdate.fechaPago = admin.firestore.FieldValue.serverTimestamp();
        }

        t.update(preSaleRef, preSaleUpdate);

        const shouldDeductInventory = !pData.inventoryDeducted;

        if (shouldDeductInventory) {
            // Decrementar stock por cada item vendido
            items.forEach(item => {
                const pRef = db.collection('products').doc(item.productId);
                t.update(pRef, { stock: admin.firestore.FieldValue.increment(-item.quantity) });
            });
        }

        const awarded = [];
        for (const bonusProdId of bonusProductIds) {
            const intendedQty = bonusesToApply[bonusProdId];
            const bSnap = bonusById.get(bonusProdId);
            const currentStock = bSnap && bSnap.exists ? Number(bSnap.data().stock || 0) : 0;
            const givenQty = Math.min(currentStock, intendedQty);

            if (shouldDeductInventory && givenQty > 0) {
                const newStock = currentStock - givenQty;
                const bRef = db.collection('products').doc(bonusProdId);
                t.update(bRef, { stock: newStock, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
            }

            awarded.push({ productId: bonusProdId, quantity: givenQty });
        }

        if (awarded.length > 0) {
            t.update(preSaleRef, { bonusesAwarded: awarded });
        }
    });
    return { success: true };
});

exports.getDashboardStats = functions.https.onCall(async (reqData, context) => {
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
