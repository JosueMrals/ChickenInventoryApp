import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';

const DeliveryTicket = ({ sale }) => {
  if (!sale) return null;

  const getFormattedDate = (date) => {
    if (!date) return new Date().toLocaleString();
    // Si es Timestamp de Firestore
    if (typeof date.toDate === 'function') return date.toDate().toLocaleString();
    // Si es objeto Date nativo
    if (date instanceof Date) return date.toLocaleString();
    // Intenta parsear string/otro
    return new Date(date).toLocaleString();
  };

  const bonuses = sale.bonusesAwarded || sale.bonuses || [];
  const hasBonuses = Array.isArray(bonuses) && bonuses.length > 0;

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.header}>TICKET DE ENTREGA</Text>
      <Text style={styles.subHeader}>Pre-Venta #{sale.id ? sale.id.substring(0, 8).toUpperCase() : '---'}</Text>

      <View style={styles.divider} />

      <Text style={styles.label}>Cliente:</Text>
      <Text style={styles.value}>{sale.customerName || 'Cliente General'}</Text>

      <Text style={styles.label}>Fecha Pago:</Text>
      <Text style={styles.value}>{getFormattedDate(sale.fechaPago)}</Text>

      <View style={styles.divider} />

      <View style={styles.row}>
        <Text style={[styles.headerText, { flex: 2 }]}>Producto</Text>
        <Text style={[styles.headerText, { flex: 0.5 }]}>Cant</Text>
        <Text style={[styles.headerText, { flex: 1, textAlign: 'right' }]}>Total</Text>
      </View>

      {sale.items && sale.items.map((item, index) => (
        <View key={index} style={styles.row}>
          <Text style={[styles.cellText, { flex: 2 }]}>{item.productName || item.name}</Text>
          <Text style={[styles.cellText, { flex: 0.5 }]}>{item.quantity}</Text>
          <Text style={[styles.cellText, { flex: 1, textAlign: 'right' }]}>
            ${(item.total || (item.unitPrice * item.quantity)).toFixed(2)}
          </Text>
        </View>
      ))}

      <View style={styles.divider} />

      {hasBonuses && (
         <View>
             <Text style={styles.bonusHeader}>Regalos:</Text>
             {bonuses.map((b, i) => (
                 <View key={i} style={styles.bonusRow}>
                     <Text style={styles.bonusQty}>{b.quantity}x</Text>
                     <View style={styles.bonusInfo}>
                         <Text style={styles.bonusName} numberOfLines={1}>
                             {b.productName || b.name || 'Producto Bonificado'}
                         </Text>
                         {b.linkedToName ? (
                           <Text style={styles.bonusRef} numberOfLines={1}>
                             por {b.linkedToName}
                           </Text>
                         ) : null}
                     </View>
                 </View>
             ))}
             <View style={styles.divider} />
         </View>
      )}

      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>TOTAL A PAGAR:</Text>
        <Text style={styles.totalValue}>${sale.total ? sale.total.toFixed(2) : '0.00'}</Text>
      </View>

       <View style={styles.totalRow}>
        <Text style={styles.subTotalLabel}>Pagado:</Text>
        <Text style={styles.subTotalValue}>${sale.amountPaid ? Number(sale.amountPaid).toFixed(2) : (sale.total || 0).toFixed(2)}</Text>
      </View>

      {sale.change > 0 && (
        <View style={styles.totalRow}>
            <Text style={styles.subTotalLabel}>Cambio:</Text>
            <Text style={styles.subTotalValue}>${Number(sale.change).toFixed(2)}</Text>
        </View>
      )}

      <Text style={styles.footer}>¡Gracias por su compra!</Text>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#eee',
    margin: 10,
  },
  header: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 5,
    color: '#333',
  },
  subHeader: {
    fontSize: 14,
    textAlign: 'center',
    color: '#666',
    marginBottom: 10,
  },
  divider: {
    height: 1,
    backgroundColor: '#ddd',
    marginVertical: 10,
  },
  label: {
    fontSize: 12,
    color: '#888',
    marginBottom: 2,
  },
  value: {
    fontSize: 16,
    color: '#333',
    marginBottom: 8,
    fontWeight: '500',
  },
  row: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  headerText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#555',
  },
  cellText: {
    fontSize: 14,
    color: '#333',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 5,
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2DCE89',
  },
    subTotalLabel: {
    fontSize: 14,
    color: '#555',
  },
  subTotalValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '600'
  },
  bonusHeader: {
      fontSize: 12,
      fontWeight: 'bold',
      color: '#e67eff',
      marginBottom: 4
  },
  bonusRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 4
  },
  bonusQty: {
      width: 32,
      fontSize: 12,
      fontWeight: '700',
      color: '#555'
  },
  bonusInfo: {
      flex: 1
  },
  bonusName: {
      fontSize: 12,
      color: '#555'
  },
  bonusRef: {
      fontSize: 11,
      color: '#888'
  },
  footer: {
    marginTop: 20,
    textAlign: 'center',
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
  }
});

export default DeliveryTicket;
