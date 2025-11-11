// services/saleService.js
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';

/**
 * Genera y retorna el siguiente número de venta de forma atómica.
 * Ejemplo: "000123"
 */
async function getNextSaleNumber() {
  const counterRef = firestore().collection('counters').doc('sales');
  return await firestore().runTransaction(async (transaction) => {
    const doc = await transaction.get(counterRef);

    let next = 1;
    if (doc.exists && doc.data()?.lastNumber) {
      next = doc.data().lastNumber + 1;
    }

    transaction.set(counterRef, { lastNumber: next }, { merge: true });
    return String(next).padStart(6, '0'); // formato tipo "000123"
  });
}

/**
 * Crea una venta en Firestore con control de stock, créditos y numeración secuencial.
 */
export async function registerSale(product, customer, quantity, form) {
  const saleNumber = await getNextSaleNumber();
  const subtotal = product.price * quantity;
  const discountValue = parseFloat(form.discountValue || 0);
  const discount =
    form.discountType === 'percent'
      ? subtotal * (discountValue / 100)
      : form.discountType === 'amount'
      ? discountValue
      : 0;
  const total = subtotal - discount;
  const paid = parseFloat(form.paidAmount || 0);
  const pending = total - paid;

  const paymentMethod = form.paymentMethod;
  const user = auth().currentUser;

  const saleData = {
    receiptNumber: saleNumber,
    productId: product.id,
    productName: product.name,
    quantity,
    price: product.price,
    subtotal,
    discount,
    total,
    paid,
    pending,
    paymentMethod,
    transferNumber: form.transferNumber || '',
    soldBy: user.email,
    soldById: user.uid,
    clientId: customer.id,
    clientName: `${customer.firstName} ${customer.lastName}`,
    clientPhone: customer.phone || '',
    createdAt: new Date(),
  };

  try {
    // Guardar venta
    const saleRef = await firestore().collection('sales').add(saleData);

    // Reducir stock
    await firestore().collection('products').doc(product.id).update({
      stock: Math.max(product.stock - quantity, 0),
      updatedAt: new Date(),
    });

    // Si hay saldo pendiente → registrar crédito
    if (pending > 0) {
      await firestore().collection('credits').add({
        saleId: saleRef.id,
        clientId: customer.id,
        clientName: saleData.clientName,
        total,
        paid,
        pending,
        status: 'pending',
        createdAt: new Date(),
      });
    }

    return saleRef.id;
  } catch (e) {
    console.error('🔥 Error al crear venta:', e);
    throw e;
  }
}
