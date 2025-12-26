import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import styles from '../../quicksalesNew/styles/doneReceiptStyles';

const SaleReceipt = ({ sale }) => {
  const paymentLabels = {
    cash: 'Efectivo',
    card: 'Tarjeta',
  };

  return (
    <ScrollView style={styles.receiptBox} showsVerticalScrollIndicator={false}>
      <Text style={styles.bigCheck}>✓</Text>
      <Text style={styles.successText}>Venta completada</Text>

      {/* FECHA */}
      <View style={styles.section}>
        <Text style={styles.label}>Fecha:</Text>
        <Text style={styles.value}>
          {sale.createdAt.toDate().toLocaleString()}
        </Text>
      </View>

      {/* CLIENTE */}
      <View style={styles.section}>
        <Text style={styles.label}>Cliente:</Text>
        <Text style={styles.value}>{sale.customerName}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Recibo #:</Text>
        <Text style={styles.value}>{sale.receiptNumber}</Text>
      </View>

      <View style={styles.separator} />

      {/* PRODUCTOS */}
      <Text style={styles.sectionTitle}>Productos</Text>

      {sale.items.map((item) => (
        <View key={item.id} style={styles.itemRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.itemName}>{item.name}</Text>
            <Text style={styles.itemDetails}>
              {item.quantity} x C${item.unitPrice.toFixed(2)}
            </Text>
          </View>

          <Text style={styles.itemTotal}>
            C${item.total.toFixed(2)}
          </Text>
        </View>
      ))}

      <View style={styles.separator} />

      {/* RESUMEN */}
      <View style={styles.summaryRow}>
        <Text style={styles.label}>Subtotal</Text>
        <Text style={styles.value}>C${sale.subtotal.toFixed(2)}</Text>
      </View>

      <View style={styles.summaryRow}>
        <Text style={styles.totalLabel}>Total</Text>
        <Text style={styles.totalValue}>C${sale.total.toFixed(2)}</Text>
      </View>

      <View style={styles.summaryRow}>
        <Text style={styles.label}>Pagado</Text>
        <Text style={styles.value}>C${sale.amountPaid.toFixed(2)}</Text>
      </View>

      {sale.change > 0 && (
        <View style={styles.summaryRow}>
          <Text style={styles.label}>Cambio</Text>
          <Text style={styles.value}>C${sale.change.toFixed(2)}</Text>
        </View>
      )}

      <View style={styles.summaryRow}>
        <Text style={styles.label}>Método de pago</Text>
        <Text style={styles.value}>{paymentLabels[sale.paymentMethod]}</Text>
      </View>

      <View style={styles.separator} />

      <Text style={styles.footerText}>¡Gracias por su compra!</Text>
    </ScrollView>
  );
};

export default SaleReceipt;