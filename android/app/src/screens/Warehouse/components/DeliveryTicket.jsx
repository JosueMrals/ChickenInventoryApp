import React, { useMemo } from 'react';
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

  const categoryDiscountTotal = useMemo(() => {
    if (Number(sale?.categoryDiscountTotal || 0) > 0) return Number(sale.categoryDiscountTotal);
    const items = Array.isArray(sale?.items) ? sale.items : [];
    const byCategory = items.reduce((acc, item) => {
      if (String(item?.pricingSource || '').toLowerCase() !== 'category') return acc;
      const key = String(item?.category || item?.categoryName || item?.productName || 'sin_categoria').toLowerCase();
      acc[key] = (acc[key] || 0) + Number(item?.autoDiscountTotal || 0);
      return acc;
    }, {});
    return Object.values(byCategory).reduce((sum, value) => sum + Number((Number(value) || 0).toFixed(2)), 0);
  }, [sale]);

  const summary = useMemo(() => {
    const items = Array.isArray(sale?.items) ? sale.items : [];

    const subtotalNoDiscounts = items.reduce((sum, item) => {
      const qty = Number(item?.quantity || 0);
      const lineBase = Number(item?.lineBaseTotal || 0) || (Number(item?.baseUnitPrice || 0) * qty);
      return sum + (lineBase || (Number(item?.unitPrice || 0) * qty));
    }, 0);

    const categoryDiscount = items.reduce((sum, item) => {
      if (String(item?.pricingSource || '').toLowerCase() !== 'category') return sum;
      return sum + Number(item?.autoDiscountTotal || 0);
    }, 0);

    const customerDiscount = items.reduce((sum, item) => {
      if (String(item?.pricingSource || '').toLowerCase() !== 'customer') return sum;
      return sum + Number(item?.autoDiscountTotal || 0);
    }, 0);

    const manualDiscount = items.reduce((sum, item) => sum + Number(item?.discount || 0), 0);

    const discountsTotal = categoryDiscount + customerDiscount + manualDiscount;
    const totalToPay = Math.max(0, subtotalNoDiscounts - discountsTotal);

    return {
      subtotalNoDiscounts: Number(subtotalNoDiscounts.toFixed(2)),
      categoryDiscount: Number(categoryDiscount.toFixed(2)),
      customerDiscount: Number(customerDiscount.toFixed(2)),
      manualDiscount: Number(manualDiscount.toFixed(2)),
      discountsTotal: Number(discountsTotal.toFixed(2)),
      totalToPay: Number(totalToPay.toFixed(2)),
    };
  }, [sale]);

  const getPricingTag = (item) => {
    const source = String(item?.pricingSource || '').toLowerCase();

    if (source === 'category') {
      const minQty = Number(item?.categoryDiscountMinQty || 0);
      const type = String(item?.categoryDiscountType || '').toLowerCase();
      const value = Number(item?.categoryDiscountValue || 0);
      if (minQty > 0 && value > 0 && ['percent', 'amount'].includes(type)) {
        const valueText = type === 'percent' ? `${value}%` : `$${value.toFixed(2)}`;
        return `Cat ${minQty}+ -> ${valueText}`;
      }
      return 'Descuento categoria';
    }

    if (source === 'wholesale') return 'Mayorista';
    if (source === 'customer') return 'Descuento cliente';
    if (Number(item?.discount || 0) > 0) return 'Descuento manual';
    return null;
  };

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

      {sale.items && sale.items.map((item, index) => {
        const pricingTag = getPricingTag(item);
        const hasManualDiscount = Number(item?.discount || 0) > 0;

        return (
          <View key={index} style={styles.itemBox}>
            <View style={styles.row}>
              <Text style={[styles.cellText, { flex: 2, fontFamily, fontSize: baseFontSize }]}>{item.productName || item.name}</Text>
              <Text style={[styles.cellText, { flex: 0.5, fontFamily, fontSize: baseFontSize }]}>{item.quantity}</Text>
              <Text style={[styles.cellText, { flex: 1, textAlign: 'right', fontFamily, fontSize: baseFontSize }]}>
                ${(item.total || (item.unitPrice * item.quantity)).toFixed(2)}
              </Text>
            </View>
            <View style={styles.itemMetaRow}>
              <Text style={[styles.itemMetaText, { fontFamily, fontSize: baseFontSize - 2 }]}
              >
                {item.quantity} x ${(Number(item.unitPrice) || 0).toFixed(2)}
              </Text>
              {pricingTag ? <Text style={[styles.itemTag, { fontFamily, fontSize: baseFontSize - 3 }]}>{pricingTag}</Text> : null}
            </View>
            {hasManualDiscount ? (
              <Text style={[styles.manualDiscountText, { fontFamily, fontSize: baseFontSize - 3 }]}>Manual: -${Number(item.discount || 0).toFixed(2)}</Text>
            ) : null}
          </View>
        );
      })}

      <View style={styles.divider} />

      <View style={styles.totalRow}>
        <Text style={[styles.subTotalLabel, { fontFamily, fontSize: baseFontSize }]}>Subtotal:</Text>
        <Text style={[styles.subTotalValue, { fontFamily, fontSize: baseFontSize }]}>${summary.subtotalNoDiscounts.toFixed(2)}</Text>
      </View>

      {summary.manualDiscount > 0 && (
        <View style={styles.totalRow}>
          <Text style={[styles.subTotalLabel, { fontFamily, fontSize: baseFontSize }]}>Desc. manual:</Text>
          <Text style={[styles.subTotalValue, { fontFamily, fontSize: baseFontSize }]}>-${summary.manualDiscount.toFixed(2)}</Text>
        </View>
      )}

      {summary.categoryDiscount > 0 && (
        <View style={styles.totalRow}>
          <Text style={[styles.subTotalLabel, { fontFamily, fontSize: baseFontSize }]}>Desc. categoria:</Text>
          <Text style={[styles.subTotalValue, { fontFamily, fontSize: baseFontSize }]}>-${summary.categoryDiscount.toFixed(2)}</Text>
        </View>
      )}

      {summary.customerDiscount > 0 && (
        <View style={styles.totalRow}>
          <Text style={[styles.subTotalLabel, { fontFamily, fontSize: baseFontSize }]}>Desc. cliente:</Text>
          <Text style={[styles.subTotalValue, { fontFamily, fontSize: baseFontSize }]}>-${summary.customerDiscount.toFixed(2)}</Text>
        </View>
      )}

      <View style={styles.totalRow}>
        <Text style={[styles.subTotalLabel, { fontFamily, fontSize: baseFontSize }]}>Descuentos:</Text>
        <Text style={[styles.subTotalValue, { fontFamily, fontSize: baseFontSize }]}>-${summary.discountsTotal.toFixed(2)}</Text>
      </View>

      <View style={styles.totalRow}>
        <Text style={[styles.totalLabel, { fontFamily, fontSize: baseFontSize + 4 }]}>TOTAL A PAGAR:</Text>
        <Text style={[styles.totalValue, { fontFamily, fontSize: baseFontSize + 4 }]}>${summary.totalToPay.toFixed(2)}</Text>
      </View>

       <View style={styles.totalRow}>
        <Text style={[styles.subTotalLabel, { fontFamily, fontSize: baseFontSize }]}>
          Pagado:
        </Text>
        <Text style={[styles.subTotalValue, { fontFamily, fontSize: baseFontSize }]}>
          ${sale.amountPaid ? Number(sale.amountPaid).toFixed(2) : summary.totalToPay.toFixed(2)}
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
    marginBottom: 4,
  },
  itemBox: {
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 6,
    marginBottom: 6,
  },
  itemMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemMetaText: {
    color: '#6B7280',
    flex: 1,
  },
  itemTag: {
    color: '#1D4ED8',
    fontWeight: '700',
    marginLeft: 8,
  },
  manualDiscountText: {
    color: '#B91C1C',
    marginTop: 2,
    fontWeight: '700',
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
