import firestore from '@react-native-firebase/firestore';
import auth from "@react-native-firebase/auth";

const presalesCollection = firestore().collection('presales');
const salesCollection = firestore().collection('sales');
const countersCollection = firestore().collection('counters');

// Helper to get next sale number (reused from quick sales)
const getNextSaleNumber = async () => {
  const ref = countersCollection.doc("sales");
  return firestore().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const next = (snap.data()?.lastNumber || 0) + 1;
    tx.set(ref, { lastNumber: next }, { merge: true });
    return String(next).padStart(6, "0");
  });
};

export const getNextPreSaleNumber = async () => {
  const counterDocRef = countersCollection.doc('preSaleCounter');
  return firestore().runTransaction(async (transaction) => {
    const doc = await transaction.get(counterDocRef);
    const newNumber = (doc.data()?.currentNumber || 0) + 1;
    transaction.set(counterDocRef, { currentNumber: newNumber });
    return newNumber;
  });
};

export const savePreSaleToFirestore = async (preSaleData) => {
  const preSaleNumber = await getNextPreSaleNumber();
  const user = auth().currentUser;
  const newPreSale = {
    customer: preSaleData.customer,
    subtotal: preSaleData.subtotal,
    totalDiscount: preSaleData.totalDiscount,
    total: preSaleData.total,
    preSaleNumber,
    status: 'pending',
    createdAt: firestore.FieldValue.serverTimestamp(),
    createdBy: user?.email || 'N/A',
    items: preSaleData.cart.filter(item => !item.isBonus).map(({ product, ...rest }) => ({ ...rest, productId: product.id, productName: product.name })),
    bonuses: preSaleData.cart.filter(item => item.isBonus).map(({ product, ...rest }) => ({ ...rest, productId: product.id, productName: product.name })),
  };
  const docRef = await presalesCollection.add(newPreSale);
  return { ...newPreSale, id: docRef.id };
};

export const getPreSalesFromFirestore = async () => {
  const snapshot = await presalesCollection.orderBy('createdAt', 'desc').get();
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

/**
 * NEW: Converts a pre-sale into a final sale document.
 * This is the core logic for the new payment flow.
 */
export const convertPreSaleToSale = async (preSale, paymentDetails) => {
  const db = firestore();
  const writeBatch = db.batch();
  const user = auth().currentUser;
  const saleDate = firestore.FieldValue.serverTimestamp();
  
  // 1. Generate a new, official sale receipt number
  const receiptNumber = await getNextSaleNumber();
  
  // 2. Create the new sale document
  const newSaleRef = salesCollection.doc();
  const saleData = {
    receiptNumber,
    subtotal: preSale.subtotal,
    totalDiscount: preSale.totalDiscount,
    total: preSale.total,
    items: preSale.items, // Already in correct format
    ...paymentDetails, // amountPaid, change, paymentMethod
    createdAt: saleDate,
    customer: preSale.customer,
    soldBy: user?.email || "N/A",
    soldById: user?.uid || "N/A",
    origin: 'presale', // For tracking
    originId: preSale.id,
  };
  writeBatch.set(newSaleRef, saleData);

  // 3. Mark the original pre-sale as 'paid'
  const preSaleRef = presalesCollection.doc(preSale.id);
  writeBatch.update(preSaleRef, { status: 'paid', paidAt: saleDate, convertedToSaleId: newSaleRef.id });
  
  // 4. Update inventory and create bonus movements
  const fullCart = [...(preSale.items || []), ...(preSale.bonuses || [])];
  const productIds = [...new Set(fullCart.map(item => item.productId))];

  if (productIds.length > 0) {
      const productsSnapshot = await db.collection('products').where(firestore.FieldPath.documentId(), 'in', productIds).get();
      const productsData = {};
      productsSnapshot.forEach(doc => { productsData[doc.id] = doc.data(); });

      fullCart.forEach(item => {
        const productRef = db.collection('products').doc(item.productId);
        writeBatch.update(productRef, { stock: firestore.FieldValue.increment(-item.quantity) });

        if (item.isBonus) {
          const productInfo = productsData[item.productId];
          if (productInfo) {
            const movementRef = db.collection("inventoryMovements").doc();
            writeBatch.set(movementRef, {
              productId: item.productId,
              productName: productInfo.name,
              quantity: item.quantity,
              type: 'BONUS_OUT',
              reason: 'Bonificación por Pre-Venta',
              cost: productInfo.purchasePrice || 0,
              totalCost: (productInfo.purchasePrice || 0) * item.quantity,
              relatedSaleId: newSaleRef.id,
              relatedReceipt: receiptNumber,
              user: user?.email || "",
              createdAt: saleDate,
            });
          }
        }
      });
  }
  
  await writeBatch.commit();
  return newSaleRef.id; // Return the ID of the new sale document
};

// Deprecated function, logic is now in convertPreSaleToSale
export const processPreSalePayment = async (preSaleId, cart) => {
  console.warn("processPreSalePayment is deprecated. Use convertPreSaleToSale instead.");
  // The new flow handles this through the conversion process.
  return Promise.resolve();
};