import React from 'react';
import { View, Text, StyleSheet, ScrollView, Image } from 'react-native';

const DeliveryTicket = ({ sale, settings }) => {
  if (!sale) return null;

  const fontFamily = settings?.fontFamily || 'System';
  const baseFontSize = Number(settings?.fontSize || 14);
  const headerImageUri = settings?.headerImageUri || '';
  const headerUri = headerImageUri && !headerImageUri.startsWith('file://') && !headerImageUri.startsWith('content://') && !headerImageUri.startsWith('http')
    ? `file://${headerImageUri}`
    : headerImageUri;

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
  const isCredit = sale.paymentMethod === 'credit' || String(sale.status || '').startsWith('credit_');

  return (
    <ScrollView style={styles.container}>
      {headerUri ? (
        <Image source={{ uri: headerUri }} style={styles.headerImage} resizeMode="contain" />
      ) : null}
      <Text style={[styles.header, { fontFamily, fontSize: baseFontSize + 6 }]}>TICKET DE ENTREGA</Text>
      <Text style={[styles.subHeader, { fontFamily, fontSize: baseFontSize }]}>
        Pre-Venta #{sale.id ? sale.id.substring(0, 8).toUpperCase() : '---'}
      </Text>
      {isCredit && (
        <View style={styles.creditBanner}>
          <Text style={[styles.creditBannerText, { fontFamily, fontSize: baseFontSize - 1 }]}>PRE-VENTA A CRÉDITO</Text>
        </View>
      )}

      <View style={styles.divider} />

      <Text style={[styles.label, { fontFamily, fontSize: baseFontSize - 2 }]}>Cliente:</Text>
      <Text style={[styles.value, { fontFamily, fontSize: baseFontSize + 2 }]}>{sale.customerName || 'Cliente General'}</Text>

      <Text style={[styles.label, { fontFamily, fontSize: baseFontSize - 2 }]}>Fecha Pago:</Text>
      <Text style={[styles.value, { fontFamily, fontSize: baseFontSize + 2 }]}>{getFormattedDate(sale.fechaPago)}</Text>

      <Text style={[styles.label, { fontFamily, fontSize: baseFontSize - 2 }]}>Tipo:</Text>
      <Text style={[styles.value, { fontFamily, fontSize: baseFontSize + 2 }]}>{isCredit ? 'Crédito' : 'Contado'}</Text>

      <View style={styles.divider} />

      <View style={styles.row}>
        <Text style={[styles.headerText, { flex: 2, fontFamily, fontSize: baseFontSize - 2 }]}>Producto</Text>
        <Text style={[styles.headerText, { flex: 0.5, fontFamily, fontSize: baseFontSize - 2 }]}>Cant</Text>
        <Text style={[styles.headerText, { flex: 1, textAlign: 'right', fontFamily, fontSize: baseFontSize - 2 }]}>Total</Text>
      </View>

      {sale.items && sale.items.map((item, index) => (
        <View key={index} style={styles.row}>
          <Text style={[styles.cellText, { flex: 2, fontFamily, fontSize: baseFontSize }]}>{item.productName || item.name}</Text>
          <Text style={[styles.cellText, { flex: 0.5, fontFamily, fontSize: baseFontSize }]}>{item.quantity}</Text>
          <Text style={[styles.cellText, { flex: 1, textAlign: 'right', fontFamily, fontSize: baseFontSize }]}>
            ${(item.total || (item.unitPrice * item.quantity)).toFixed(2)}
          </Text>
        </View>
      ))}

      <View style={styles.divider} />

      {hasBonuses && (
         <View>
             <Text style={[styles.bonusHeader, { fontFamily, fontSize: baseFontSize - 2 }]}>Regalos:</Text>
             {bonuses.map((b, i) => (
                 <View key={i} style={styles.bonusRow}>
                     <Text style={[styles.bonusQty, { fontFamily, fontSize: baseFontSize - 2 }]}>{b.quantity}x</Text>
                     <View style={styles.bonusInfo}>
                         <Text style={[styles.bonusName, { fontFamily, fontSize: baseFontSize - 2 }]} numberOfLines={1}>
                             {b.productName || b.name || 'Producto Bonificado'}
                         </Text>
                         {b.linkedToName ? (
                           <Text style={[styles.bonusRef, { fontFamily, fontSize: baseFontSize - 3 }]} numberOfLines={1}>
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
        <Text style={[styles.totalLabel, { fontFamily, fontSize: baseFontSize + 4 }]}>TOTAL A PAGAR:</Text>
        <Text style={[styles.totalValue, { fontFamily, fontSize: baseFontSize + 4 }]}>${sale.total ? sale.total.toFixed(2) : '0.00'}</Text>
      </View>

       <View style={styles.totalRow}>
        <Text style={[styles.subTotalLabel, { fontFamily, fontSize: baseFontSize }]}>
          Pagado:
        </Text>
        <Text style={[styles.subTotalValue, { fontFamily, fontSize: baseFontSize }]}>
          ${sale.amountPaid ? Number(sale.amountPaid).toFixed(2) : (sale.total || 0).toFixed(2)}
        </Text>
      </View>

      {sale.change > 0 && (
        <View style={styles.totalRow}>
            <Text style={[styles.subTotalLabel, { fontFamily, fontSize: baseFontSize }]}>Cambio:</Text>
            <Text style={[styles.subTotalValue, { fontFamily, fontSize: baseFontSize }]}>${Number(sale.change).toFixed(2)}</Text>
        </View>
      )}

      <Text style={[styles.footer, { fontFamily, fontSize: baseFontSize - 2 }]}>¡Gracias por su compra!</Text>
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
  headerImage: {
    width: '100%',
    height: 70,
    marginBottom: 10,
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
  },
  creditBanner: {
    alignSelf: 'center',
    backgroundColor: '#111827',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 6,
  },
  creditBannerText: {
    color: '#fff',
    fontWeight: '700',
  }
});

export default DeliveryTicket;
