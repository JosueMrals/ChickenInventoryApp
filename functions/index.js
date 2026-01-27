const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

const db = admin.firestore();

// Helper para normalizar el payload 'data'
// Algunos SDKs envían los datos envueltos en una propiedad 'data'
const getPayload = (data) => {
    if (data && typeof data === 'object' && data.data) {
        return data.data;
    }
    return data;
};

/**
 * Cloud Function para que un 'bodeguero' despache una pre-venta a un 'entregador'.
 */
exports.dispatchPreSale = functions.https.onCall(async (reqData, context) => {
    // 1. Normalizar datos
    const data = getPayload(reqData);
    let uid;

    // --- BLOQUE DE DIAGNÓSTICO ---
    const debugInfo = {
        contextAuth: context && context.auth ? 'YES' : 'NO',
        payloadKeys: data ? Object.keys(data) : [],
        hasAuthToken: data && data.authToken ? 'YES' : 'NO',
        tokenLength: data && data.authToken ? data.authToken.length : 0
    };
    console.log("[DEBUG] dispatchPreSale normalized start:", JSON.stringify(debugInfo));
    // -----------------------------

    // 2. Autenticación (Contexto o Manual)
    if (context.auth) {
        uid = context.auth.uid;
    }
    else if (data && data.authToken) {
        try {
            const decodedToken = await admin.auth().verifyIdToken(data.authToken);
            uid = decodedToken.uid;
            console.log(`Token verificado manualmente para usuario: ${uid}`);
        } catch (error) {
            console.error("Error verificando token manual:", error);
            throw new functions.https.HttpsError('unauthenticated', `Token inválido: ${error.message}`);
        }
    } else {
        const errorMsg = `DEBUG INFO: ContextAuth=${debugInfo.contextAuth}, PayloadKeys=${JSON.stringify(debugInfo.payloadKeys)}, TokenLen=${debugInfo.tokenLength}`;
        console.error("Fallo de autenticación:", errorMsg);
        throw new functions.https.HttpsError('unauthenticated', errorMsg);
    }

    // 3. Verificar Rol de Bodeguero
    const userDoc = await db.collection('users').doc(uid).get();
    if (!userDoc.exists || userDoc.data().role !== 'bodeguero') {
        throw new functions.https.HttpsError('permission-denied', 'El usuario no tiene permisos de bodeguero.');
    }

    const { preSaleId, entregadorId } = data;
    if (!preSaleId || !entregadorId) {
        throw new functions.https.HttpsError('invalid-argument', 'Los parámetros preSaleId y entregadorId son requeridos.');
    }

    try {
        const preSaleRef = db.collection('presales').doc(preSaleId);

        const docSnap = await preSaleRef.get();
        if (!docSnap.exists) {
            throw new functions.https.HttpsError('not-found', `La pre-venta con ID ${preSaleId} no existe en la colección 'presales'.`);
        }

        await preSaleRef.update({
            status: 'dispatched',
            entregadorId: entregadorId,
            fechaEntregaRepartidor: admin.firestore.FieldValue.serverTimestamp()
        });

        return { success: true, message: 'Pre-venta despachada correctamente.' };
    } catch (error) {
        console.error("Error en dispatchPreSale:", error);
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        throw new functions.https.HttpsError('internal', 'Ocurrió un error al despachar la pre-venta.');
    }
});

/**
 * Cloud Function para que un 'entregador' complete el pago de una pre-venta.
 */
exports.completePreSalePayment = functions.https.onCall(async (reqData, context) => {
    const data = getPayload(reqData);
    let uid;

    if (context.auth) {
        uid = context.auth.uid;
    } else if (data && data.authToken) {
        try {
            const decodedToken = await admin.auth().verifyIdToken(data.authToken);
            uid = decodedToken.uid;
        } catch (error) {
            throw new functions.https.HttpsError('unauthenticated', 'Token de autenticación inválido.');
        }
    } else {
        throw new functions.https.HttpsError('unauthenticated', 'El usuario debe estar autenticado.');
    }

    const { preSaleId } = data;
    if (!preSaleId) {
        throw new functions.https.HttpsError('invalid-argument', 'El parámetro preSaleId es requerido.');
    }

    const preSaleRef = db.collection('presales').doc(preSaleId);

    try {
        await db.runTransaction(async (transaction) => {
            const preSaleDoc = await transaction.get(preSaleRef);
            if (!preSaleDoc.exists) {
                throw new functions.https.HttpsError('not-found', 'La pre-venta no existe.');
            }

            const preSaleData = preSaleDoc.data();

            if (preSaleData.entregadorId !== uid) {
                throw new functions.https.HttpsError('permission-denied', 'No eres el entregador asignado para esta pre-venta.');
            }

            if (preSaleData.status !== 'dispatched') {
                 throw new functions.https.HttpsError('failed-precondition', 'La pre-venta no está en estado de reparto.');
            }

            transaction.update(preSaleRef, {
                status: 'paid',
                fechaPago: admin.firestore.FieldValue.serverTimestamp()
            });

            if (preSaleData.items && Array.isArray(preSaleData.items)) {
                for (const item of preSaleData.items) {
                    const productRef = db.collection('products').doc(item.productId);
                    transaction.update(productRef, {
                        stock: admin.firestore.FieldValue.increment(-item.quantity)
                    });
                }
            }
        });

        return { success: true, message: 'Pago completado y stock actualizado.' };

    } catch (error) {
        console.error("Error en completePreSalePayment:", error);
        throw new functions.https.HttpsError('internal', error.message || 'Error al procesar el pago.');
    }
});

/**
 * Cloud Function para obtener estadísticas del dashboard.
 */
exports.getDashboardStats = functions.https.onCall(async (reqData, context) => {
    const data = getPayload(reqData);
    let uid;

    if (context.auth) {
        uid = context.auth.uid;
    } else if (data && data.authToken) {
        try {
            const decoded = await admin.auth().verifyIdToken(data.authToken);
            uid = decoded.uid;
        } catch (e) {
             throw new functions.https.HttpsError('unauthenticated', 'Token inválido');
        }
    } else {
         throw new functions.https.HttpsError('unauthenticated', 'Sin credenciales');
    }

    const userDoc = await db.collection('users').doc(uid).get();
    if (!userDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Usuario no encontrado.');
    }
    const role = userDoc.data().role;

    let stats = {};

    if (role === 'admin') {
        const [productsSnap, lowStockSnap, usersSnap] = await Promise.all([
            db.collection('products').get(),
            db.collection('products').where('stock', '<=', 5).get(),
            db.collection('users').get()
        ]);
        stats = {
            products: productsSnap.size,
            lowStock: lowStockSnap.size,
            users: usersSnap.size,
            verifiedUsers: usersSnap.docs.filter(doc => doc.data().emailVerified).length
        };
    } else if (role === 'bodeguero') {
        const [pendingSnap, readySnap] = await Promise.all([
            db.collection('presales').where('status', '==', 'pending').get(),
            db.collection('presales').where('status', '==', 'ready_for_delivery').get()
        ]);
        stats = {
            pendingPreSales: pendingSnap.size,
            readyForDelivery: readySnap.size
        };
    } else if (role === 'entregador') {
        const assignedSnap = await db.collection('presales')
                                  .where('entregadorId', '==', uid)
                                  .where('status', '==', 'dispatched')
                                  .get();
        stats = {
            assignedDeliveries: assignedSnap.size,
            totalToCollect: assignedSnap.docs.reduce((sum, doc) => sum + (doc.data().total || 0), 0)
        };
    } else {
        const [productsSnap, lowStockSnap] = await Promise.all([
            db.collection('products').get(),
            db.collection('products').where('stock', '<=', 5).get()
        ]);
        stats = {
            products: productsSnap.size,
            lowStock: lowStockSnap.size
        };
    }
    return stats;
});
