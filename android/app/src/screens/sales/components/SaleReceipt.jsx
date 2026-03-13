import React, { useMemo } from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import Icon from "react-native-vector-icons/Ionicons";

const formatCurrency = (val) => `$${(Number(val) || 0).toFixed(2)}`;

function getItemChips(item) {
  const chips = [];
  const source = String(item?.pricingSource || '').toLowerCase();

  if (source === 'category') {
    const minQty = Number(item?.categoryDiscountMinQty || 0);
    const type = String(item?.categoryDiscountType || '').toLowerCase();
    const value = Number(item?.categoryDiscountValue || 0);
    if (minQty > 0 && value > 0 && ['percent', 'amount'].includes(type)) {
      const valueText = type === 'percent' ? `${value}%` : formatCurrency(value);
      chips.push({ text: `Cat. ${minQty}+ -> ${valueText}`, tone: 'category' });
    } else {
      chips.push({ text: 'Descuento categoria', tone: 'category' });
    }
  }

  if (source === 'wholesale') chips.push({ text: 'Mayorista', tone: 'neutral' });
  if (source === 'customer') chips.push({ text: 'Descuento cliente', tone: 'neutral' });
  if (Number(item?.discount || 0) > 0) chips.push({ text: 'Descuento manual', tone: 'manual' });

  return chips;
}

function computeCategoryDiscountTotal(items = []) {
  const byCategory = items.reduce((acc, item) => {
    if (String(item?.pricingSource || '').toLowerCase() !== 'category') return acc;
    const key = String(item?.category || item?.categoryName || item?.productName || 'sin_categoria').toLowerCase();
    acc[key] = (acc[key] || 0) + Number(item?.autoDiscountTotal || 0);
    return acc;
  }, {});

  return Object.values(byCategory).reduce((sum, value) => sum + Number((Number(value) || 0).toFixed(2)), 0);
}

const Chip = ({ text, tone = 'neutral' }) => (
  <View style={[styles.chip, tone === 'category' && styles.chipCategory, tone === 'manual' && styles.chipManual]}>
    <Text style={[styles.chipText, tone === 'category' && styles.chipTextCategory, tone === 'manual' && styles.chipTextManual]}>{text}</Text>
  </View>
);

export default function SaleReceipt({ sale, bonuses = [] }) {
  if (!sale) return null;

  const saleDate = sale.createdAt && typeof sale.createdAt.toDate === 'function'
    ? sale.createdAt.toDate()
    : new Date();

  const formattedDate = saleDate.toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });
  const formattedTime = saleDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

  const { subtotal, manualDiscountTotal, total, categoryDiscountTotal } = useMemo(() => {
    const items = Array.isArray(sale.items) ? sale.items : [];
    const subtotalCalc = Number(sale?.subtotal || 0) || items.reduce((sum, item) => sum + (Number(item.quantity || 0) * Number(item.unitPrice || 0)), 0);
    const manualDiscountCalc = Number(sale?.totalDiscount || sale?.discount || 0) || items.reduce((sum, item) => sum + Number(item.discount || 0), 0);
    const categoryDiscountCalc = Number(sale?.categoryDiscountTotal || 0) || computeCategoryDiscountTotal(items);
    const totalCalc = Number(sale?.total || 0) || (subtotalCalc - manualDiscountCalc);

    return {
      subtotal: subtotalCalc,
      manualDiscountTotal: manualDiscountCalc,
      total: totalCalc,
      categoryDiscountTotal: categoryDiscountCalc,
    };
  }, [sale]);

  const getCustomerName = () => {
    if (sale.customer && typeof sale.customer === 'object' && sale.customer.firstName) {
      return `${sale.customer.firstName} ${sale.customer.lastName || ''}`.trim();
    }
    if (sale.customerName) {
      return sale.customerName;
    }
    return 'Venta Rápida';
  };

  return (
    <ScrollView style={styles.receiptContainer} contentContainerStyle={{ paddingBottom: 20 }}>
      <View style={styles.receiptBox}>
        <View style={styles.header}>
          <Icon name="checkmark-circle" size={48} color="#28A745" />
          <Text style={styles.successText}>Venta Exitosa</Text>
        </View>

        <View style={styles.infoSection}>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Ticket No.</Text>
            <Text style={[styles.value, styles.ticketNumber]}>{sale.receiptNumber || 'N/A'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Fecha y Hora</Text>
            <Text style={styles.value}>{formattedDate} - {formattedTime}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Cliente</Text>
            <Text style={styles.value}>{getCustomerName()}</Text>
          </View>
        </View>

        <View style={styles.separator} />

        <Text style={styles.sectionTitle}>Productos Vendidos</Text>
        {(sale.items || []).map((item, index) => {
          const chips = getItemChips(item);
          return (
            <View key={`sale-${index}`} style={styles.itemRow}>
              <View style={styles.itemDetails}>
                <Text style={styles.itemName}>{item.productName || item.name}</Text>
                <Text style={styles.itemMeta}>{item.quantity} x {formatCurrency(item.unitPrice)}</Text>
                {chips.length > 0 && (
                  <View style={styles.chipsRow}>
                    {chips.map((chip, idx) => (
                      <Chip key={`${index}_${idx}`} text={chip.text} tone={chip.tone} />
                    ))}
                  </View>
                )}
              </View>
              <Text style={styles.itemTotal}>{formatCurrency(item.total)}</Text>
            </View>
          );
        })}

        {bonuses.length > 0 && (
          <>
            <View style={styles.separator} />
            <Text style={[styles.sectionTitle, styles.bonusTitle]}>Productos Bonificados</Text>
            {bonuses.map((bonus, index) => (
              <View key={`bonus-${index}`} style={styles.itemRow}>
                <View style={styles.itemDetails}>
                  <Text style={styles.itemName}>{bonus.productName || bonus.name}</Text>
                  <Text style={styles.itemMeta}>{bonus.quantity} x GRATIS</Text>
                </View>
                <View style={styles.bonusTag}>
                  <Text style={styles.bonusTagText}>REGALO</Text>
                </View>
              </View>
            ))}
          </>
        )}

        <View style={styles.separator} />

        <View style={styles.summarySection}>
            <View style={styles.summaryRow}>
                <Text style={styles.label}>Subtotal</Text>
                <Text style={styles.value}>{formatCurrency(subtotal)}</Text>
            </View>
            <View style={styles.summaryRow}>
                <Text style={styles.label}>Descuentos manuales</Text>
                <Text style={styles.discount}>-{formatCurrency(manualDiscountTotal)}</Text>
            </View>
            {categoryDiscountTotal > 0 && (
              <View style={styles.summaryRow}>
                <Text style={styles.label}>Desc. categoria</Text>
                <Text style={styles.discount}>-{formatCurrency(categoryDiscountTotal)}</Text>
              </View>
            )}
            <View style={styles.summaryRowTotal}>
                <Text style={styles.totalLabel}>Total</Text>
                <Text style={styles.totalValue}>{formatCurrency(total)}</Text>
            </View>
            
            {/* --- FIX: Display Amount Paid and Change --- */}
            <View style={styles.summaryRow}>
                <Text style={styles.label}>Monto Pagado</Text>
                <Text style={styles.value}>{formatCurrency(sale.amountPaid)}</Text>
            </View>
            <View style={styles.summaryRow}>
                <Text style={styles.label}>Cambio</Text>
                <Text style={styles.value}>{formatCurrency(sale.change)}</Text>
            </View>
        </View>

        <Text style={styles.footerText}>¡Gracias por su compra!</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
    receiptContainer: { flex: 1 },
    receiptBox: {
        backgroundColor: "#fff",
        margin: 16,
        borderRadius: 16,
        padding: 20,
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    header: { alignItems: 'center', marginBottom: 20 },
    successText: { fontSize: 20, fontWeight: "bold", textAlign: "center", marginTop: 8, color: "#2C3E50" },
    infoSection: { marginBottom: 10 },
    infoRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8 },
    label: { fontSize: 15, color: "#7F8C8D" },
    value: { fontSize: 15, fontWeight: "600", color: "#34495E" },
    ticketNumber: { fontWeight: 'bold', color: '#2980B9' },
    separator: { height: 1, backgroundColor: "#ECF0F1", marginVertical: 15 },
    sectionTitle: { fontSize: 18, fontWeight: "bold", marginBottom: 10, color: "#2C3E50" },
    bonusTitle: { color: '#2980B9' },
    itemRow: { flexDirection: "row", justifyContent: "space-between", alignItems: 'center', paddingVertical: 10 },
    itemDetails: { flex: 1 },
    itemName: { fontSize: 16, fontWeight: "600", color: "#34495E" },
    itemMeta: { fontSize: 14, color: "#95A5A6", marginTop: 2 },
    chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 5 },
    chip: { backgroundColor: '#EEF2F7', borderRadius: 10, paddingHorizontal: 7, paddingVertical: 3 },
    chipCategory: { backgroundColor: '#DBEAFE' },
    chipManual: { backgroundColor: '#FEE2E2' },
    chipText: { fontSize: 10, fontWeight: '700', color: '#334155' },
    chipTextCategory: { color: '#1D4ED8' },
    chipTextManual: { color: '#B91C1C' },
    itemTotal: { fontSize: 16, fontWeight: "bold", color: "#2C3E50" },
    bonusTag: { backgroundColor: '#2980B9', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
    bonusTagText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
    summarySection: { marginTop: 10 },
    summaryRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
    summaryRowTotal: { flexDirection: "row", justifyContent: "space-between", marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#ECF0F1', marginBottom: 8},
    discount: { fontSize: 15, fontWeight: "600", color: "#E74C3C" },
    totalLabel: { fontSize: 18, fontWeight: "bold", color: "#000" },
    totalValue: { fontSize: 20, fontWeight: "bold", color: "#000" },
    footerText: { textAlign: "center", marginTop: 20, fontSize: 14, color: "#7F8C8D" },
});