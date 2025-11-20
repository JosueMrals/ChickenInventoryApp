import React from 'react';
import { View, Text } from 'react-native';
import styles from '../styles/quickDoneStyles';

export default function DoneReceiptBox({ sale }) {
  const methodNames = {
    cash: "Efectivo",
    transfer: "Transferencia",
    card: "Tarjeta",
    credit: "Crédito",
  };

  return (
    <View style={styles.box}>
      <Text style={styles.title}>Venta Completada</Text>

      <Text style={styles.row}>Usuario: {sale.userName}</Text>
      <Text style={styles.row}>Cliente: {sale.customerName}</Text>

      <Text style={styles.subTitle}>Productos</Text>

      {sale.items.map((p, i) => (
        <View key={i} style={styles.productRow}>
          <Text style={styles.prodName}>
            {p.name} × {p.qty}
          </Text>
          <Text style={styles.prodPrice}>
            C${(p.qty * p.price).toFixed(2)}
          </Text>
        </View>
      ))}

      <Text style={styles.row}>Subtotal: C${sale.subtotal.toFixed(2)}</Text>
      <Text style={styles.row}>Descuento: C${sale.discountAmount.toFixed(2)}</Text>
      <Text style={styles.row}>Total: C${sale.total.toFixed(2)}</Text>
      <Text style={styles.row}>Pagado: C${sale.paidAmount.toFixed(2)}</Text>
      <Text style={styles.row}>
        Método: {methodNames[sale.paymentMethod]}
      </Text>

      <Text style={styles.rowSmall}>
        Fecha: {new Date(sale.date).toLocaleString()}
      </Text>
    </View>
  );
}

