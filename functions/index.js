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

    const { preSaleId } = data;
    const preSaleRef = db.collection('presales').doc(preSaleId);

    await db.runTransaction(async (t) => {
        const doc = await t.get(preSaleRef);
        if (!doc.exists) throw new functions.https.HttpsError('not-found', 'No existe');
        const pData = doc.data();
        if (pData.entregadorId !== uid) throw new functions.https.HttpsError('permission-denied', 'No asignado');
        if (pData.status !== 'dispatched') throw new functions.https.HttpsError('failed-precondition', 'Estado incorrecto');

        // Actualizamos el estado de la presale a 'paid' y registramos la fecha
        t.update(preSaleRef, { status: 'paid', fechaPago: admin.firestore.FieldValue.serverTimestamp() });

        // Decrementar stock por cada item vendido
        if (pData.items) {
            // Agrupar bonificaciones a otorgar por productId
            const bonusesToApply = {};

            for (const item of pData.items) {
                const pRef = db.collection('products').doc(item.productId);
                t.update(pRef, { stock: admin.firestore.FieldValue.increment(-item.quantity) });

                // Leer producto para verificar reglas de bonificación (si las tiene)
                const prodSnap = await t.get(pRef);
                if (!prodSnap.exists) continue;
                const prodData = prodSnap.data();
                const bonuses = prodData.bonuses || (prodData.bonus ? [prodData.bonus] : []);

                if (Array.isArray(bonuses) && bonuses.length > 0) {
                    for (const b of bonuses) {
                        if (!b || !b.enabled) continue;
                        const threshold = Number(b.threshold) || 0;
                        const giveQty = Number(b.bonusQuantity) || 0;
                        if (threshold <= 0 || giveQty <= 0) continue;

                        // Calculamos cuántas veces aplica la bonificación en base a la cantidad vendida
                        const times = Math.floor(Number(item.quantity) / threshold);
                        if (times <= 0) continue;

                        const totalAward = times * giveQty;
                        const bonusProdId = b.bonusProductId;
                        if (!bonusProdId) continue;

                        if (!bonusesToApply[bonusProdId]) bonusesToApply[bonusProdId] = 0;
                        bonusesToApply[bonusProdId] += totalAward;
                    }
                }
            }

            // Aplicar decremento de stock por bonificaciones (si hay)
            const awarded = [];
            for (const bonusProdId of Object.keys(bonusesToApply)) {
                const intendedQty = bonusesToApply[bonusProdId];
                const bRef = db.collection('products').doc(bonusProdId);

                // Leer stock actual del producto regalado
                const bSnap = await t.get(bRef);
                const currentStock = bSnap.exists ? Number(bSnap.data().stock || 0) : 0;

                // Determinar cantidad que realmente se puede dar sin dejar stock negativo
                const givenQty = Math.min(currentStock, intendedQty);

                if (givenQty > 0) {
                    const newStock = currentStock - givenQty;
                    t.update(bRef, { stock: newStock, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
                    awarded.push({ productId: bonusProdId, quantity: givenQty });
                } else {
                    // Si no hay stock disponible, registramos con cantidad 0 para seguimiento (opcional)
                    awarded.push({ productId: bonusProdId, quantity: 0 });
                }
            }

            // Guardar información de bonificaciones otorgadas en la presale
            if (awarded.length > 0) {
                t.update(preSaleRef, { bonusesAwarded: awarded });
            }
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
