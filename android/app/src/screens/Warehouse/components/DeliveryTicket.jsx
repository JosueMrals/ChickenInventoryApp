import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';

// ── Helpers ───────────────────────────────────────────────────────────────────
function normalizeKey(value) {
  return String(value || '').trim().toLowerCase();
}
function resolveBonusQty(bonus) {
  return Number(bonus?.quantity || bonus?.qty || bonus?.bonusQty || 0);
}
function resolveBonusName(bonus) {
  return bonus?.productName || bonus?.name || bonus?.product?.name || 'Regalo';
}
function resolveBonusLinkKeys(bonus) {
  const keys = [
    bonus?.linkedTo, bonus?.linkedToId, bonus?.linkedItemId,
    bonus?.linkedProductId, bonus?.sourceProductId, bonus?.productId,
  ].map(normalizeKey).filter(Boolean);
  const linkedName = normalizeKey(
    bonus?.linkedProductName || bonus?.linkedToName || bonus?.sourceProductName,
  );
  if (linkedName) keys.push(linkedName);
  return Array.from(new Set(keys));
}

/** Resuelve el nombre/email del entregador/cobrador */
function getOperator(sale) {
  return (
    sale?.deliveredBy ||
    sale?.collectedBy ||
    sale?.paidBy ||
    sale?.createdBy ||
    sale?.cashierEmail ||
    null
  );
}

/** Etiqueta legible del método de pago */
function getPaymentLabel(sale) {
  const isCredit = sale.paymentMethod === 'credit' || String(sale.status || '').startsWith('credit_');
  if (isCredit) return 'Crédito';
  const map = {
    cash: 'Efectivo',
    card: 'Tarjeta',
    transfer: 'Transferencia',
    mixed: 'Mixto',
  };
  return map[String(sale?.paymentMethod || '').toLowerCase()] || sale?.paymentMethod || 'Contado';
}

/** Ahorro por ítem = descuento manual + automático */
function getItemSavings(item) {
  return Number(item?.discount || 0) + Number(item?.autoDiscountTotal || 0);
}

// ── Componente ────────────────────────────────────────────────────────────────
const DeliveryTicket = ({ sale, settings }) => {
  if (!sale) return null;

  const fontFamily = settings?.fontFamily || 'System';
  const baseFontSize = Number(settings?.fontSize || 14);
  const headerImageUri = settings?.headerImageUri || '';
  const headerUri =
    headerImageUri &&
    !headerImageUri.startsWith('file://') &&
    !headerImageUri.startsWith('content://') &&
    !headerImageUri.startsWith('http')
      ? `file://${headerImageUri}`
      : headerImageUri;

  const getFormattedDate = (date) => {
    if (!date) return new Date().toLocaleString();
    if (typeof date.toDate === 'function') return date.toDate().toLocaleString();
    if (date instanceof Date) return date.toLocaleString();
    return new Date(date).toLocaleString();
  };

  const bonuses = sale.bonusesAwarded || sale.bonuses || [];
  const hasBonuses = Array.isArray(bonuses) && bonuses.length > 0;
  const isCredit = sale.paymentMethod === 'credit' || String(sale.status || '').startsWith('credit_');
  const operator = getOperator(sale);

  const bonusesByLink = useMemo(() => {
    if (!hasBonuses) return new Map();
    const grouped = new Map();
    bonuses.forEach((bonus, index) => {
      const normalized = {
        ...bonus,
        __idx: index,
        __qty: resolveBonusQty(bonus),
        __name: resolveBonusName(bonus),
      };
      const keys = resolveBonusLinkKeys(bonus);
      if (!keys.length) {
        const list = grouped.get('__unlinked__') || [];
        list.push(normalized);
        grouped.set('__unlinked__', list);
        return;
      }
      keys.forEach((key) => {
        const list = grouped.get(key) || [];
        list.push(normalized);
        grouped.set(key, list);
      });
    });
    return grouped;
  }, [bonuses, hasBonuses]);

  const bonusKpis = useMemo(() => {
    if (!hasBonuses) return { skuCount: 0, unitsCount: 0 };
    const skuIds = new Set();
    let units = 0;
    bonuses.forEach((bonus, idx) => {
      const skuKey = normalizeKey(
        bonus?.productId || bonus?.id || bonus?.productName || bonus?.name || `bonus_${idx}`,
      );
      if (skuKey) skuIds.add(skuKey);
      units += resolveBonusQty(bonus);
    });
    return { skuCount: skuIds.size, unitsCount: Number(units.toFixed(2)) };
  }, [bonuses, hasBonuses]);

  const summary = useMemo(() => {
    const items = Array.isArray(sale?.items) ? sale.items : [];
    const subtotalNoDiscounts = items.reduce((sum, item) => {
      const qty = Number(item?.quantity || 0);
      const lineBase = Number(item?.lineBaseTotal || 0) || Number(item?.baseUnitPrice || 0) * qty;
      return sum + (lineBase || Number(item?.unitPrice || 0) * qty);
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
      const tiers = Number(item?.categoryDiscountTiersCount || 0);
      return tiers > 0 ? `Desc. categoría (${tiers} nivel${tiers !== 1 ? 'es' : ''})` : 'Desc. categoría';
    }
    if (source === 'wholesale') return 'Precio mayorista';
    if (source === 'customer') return 'Desc. cliente';
    if (Number(item?.discount || 0) > 0) return 'Desc. manual';
    return null;
  };

  const getItemBonuses = (item) => {
    if (!hasBonuses) return [];
    const keys = [
      item?.id, item?.productId, item?.product?.id,
      item?.linkedTo, item?.linkedProductId,
      item?.productName, item?.name,
    ].map(normalizeKey).filter(Boolean);
    const bucket = [];
    const used = new Set();
    keys.forEach((key) => {
      (bonusesByLink.get(key) || []).forEach((bonus) => {
        if (used.has(bonus.__idx)) return;
        used.add(bonus.__idx);
        bucket.push(bonus);
      });
    });
    return bucket;
  };

  // Número de recibo
  const receiptNum = sale.receiptNumber || sale.saleNumber || sale.preSaleNumber || null;
  const preSaleRef = sale.id ? sale.id.substring(0, 8).toUpperCase() : '---';

  return (
    <View style={styles.container}>
      {/* Imagen cabecera */}
      {headerUri ? (
        <Image source={{ uri: headerUri }} style={styles.headerImage} resizeMode="contain" />
      ) : null}

      {/* Título */}
      <Text style={[styles.header, { fontFamily, fontSize: baseFontSize + 6 }]}>
        TICKET DE ENTREGA
      </Text>
      {receiptNum ? (
        <View style={styles.ticketBadge}>
          <Text style={[styles.ticketBadgeText, { fontFamily, fontSize: baseFontSize - 1 }]}>
            Ticket #{receiptNum}
          </Text>
        </View>
      ) : (
        <Text style={[styles.subHeader, { fontFamily, fontSize: baseFontSize }]}>
          Pre-Venta #{preSaleRef}
        </Text>
      )}

      {/* Banner crédito */}
      {isCredit && (
        <View style={styles.creditBanner}>
          <Text style={[styles.creditBannerText, { fontFamily, fontSize: baseFontSize - 1 }]}>
            PRE-VENTA A CRÉDITO
          </Text>
        </View>
      )}

      <View style={styles.divider} />

      {/* Info cliente y operador */}
      <Text style={[styles.label, { fontFamily, fontSize: baseFontSize - 2 }]}>Cliente:</Text>
      <Text style={[styles.value, { fontFamily, fontSize: baseFontSize + 2 }]}>
        {sale.customerName || 'Cliente General'}
      </Text>

      <Text style={[styles.label, { fontFamily, fontSize: baseFontSize - 2 }]}>Fecha Pago:</Text>
      <Text style={[styles.value, { fontFamily, fontSize: baseFontSize + 2 }]}>
        {getFormattedDate(sale.fechaPago || sale.createdAt)}
      </Text>

      <View style={styles.infoRow}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.label, { fontFamily, fontSize: baseFontSize - 2 }]}>Tipo:</Text>
          <Text style={[styles.value, { fontFamily, fontSize: baseFontSize }]}>
            {getPaymentLabel(sale)}
          </Text>
        </View>
        {operator && (
          <View style={{ flex: 2, marginLeft: 12 }}>
            <Text style={[styles.label, { fontFamily, fontSize: baseFontSize - 2 }]}>Entregador:</Text>
            <Text
              style={[styles.operatorValue, { fontFamily, fontSize: baseFontSize }]}
              numberOfLines={1}>
              {operator}
            </Text>
          </View>
        )}
      </View>

      {/* Banner bonificaciones */}
      {hasBonuses && (
        <View style={styles.bonusSummaryCard}>
          <Text style={[styles.bonusSummaryTitle, { fontFamily, fontSize: baseFontSize - 1 }]}>
            🎁 Bonificaciones aplicadas
          </Text>
          <Text style={[styles.bonusSummaryKpi, { fontFamily, fontSize: baseFontSize - 2 }]}>
            {bonusKpis.skuCount} producto(s) · {bonusKpis.unitsCount} unidad(es)
          </Text>
        </View>
      )}

      <View style={styles.divider} />

      {/* Encabezado de tabla */}
      <View style={styles.row}>
        <Text style={[styles.headerText, { flex: 2, fontFamily, fontSize: baseFontSize - 2 }]}>Producto</Text>
        <Text style={[styles.headerText, { flex: 0.5, fontFamily, fontSize: baseFontSize - 2 }]}>Cant</Text>
        <Text style={[styles.headerText, { flex: 1, textAlign: 'right', fontFamily, fontSize: baseFontSize - 2 }]}>Total</Text>
      </View>

      {/* Ítems */}
      {(sale.items || []).map((item, index) => {
        const pricingTag = getPricingTag(item);
        const savings = getItemSavings(item);
        const itemBonuses = getItemBonuses(item);
        const itemBonusUnits = itemBonuses.reduce((s, b) => s + Number(b.__qty || 0), 0);

        return (
          <View key={index} style={styles.itemBox}>
            {/* Nombre · cant · total */}
            <View style={styles.row}>
              <Text style={[styles.cellText, { flex: 2, fontFamily, fontSize: baseFontSize }]}>
                {item.productName || item.name}
              </Text>
              <Text style={[styles.cellText, { flex: 0.5, fontFamily, fontSize: baseFontSize }]}>
                {item.quantity}
              </Text>
              <Text style={[styles.cellText, { flex: 1, textAlign: 'right', fontFamily, fontSize: baseFontSize }]}>
                C${(item.total || item.unitPrice * item.quantity || 0).toFixed(2)}
              </Text>
            </View>

            {/* Precio unitario */}
            <View style={styles.itemMetaRow}>
              <Text style={[styles.itemMetaText, { fontFamily, fontSize: baseFontSize - 2 }]}>
                {item.quantity} x C${(Number(item.unitPrice) || 0).toFixed(2)}
              </Text>
              {pricingTag ? (
                <Text style={[styles.itemTag, { fontFamily, fontSize: baseFontSize - 3 }]}>
                  {pricingTag}
                </Text>
              ) : null}
            </View>

            {/* Ahorro por ítem */}
            {savings > 0 && (
              <View style={styles.savingsRow}>
                <Text style={[styles.savingsText, { fontFamily, fontSize: baseFontSize - 3 }]}>
                  ↓ Ahorro: -C${savings.toFixed(2)}
                </Text>
              </View>
            )}

            {/* Bonificaciones vinculadas */}
            {itemBonuses.length > 0 && (
              <View style={styles.bonusItemCard}>
                <Text style={[styles.bonusItemHeader, { fontFamily, fontSize: baseFontSize - 3 }]}>
                  🎁 Regalos por este producto ({itemBonusUnits} uds.)
                </Text>
                {itemBonuses.map((bonus, bi) => (
                  <View key={`${bonus.__idx}_${bi}`} style={styles.bonusRowCompact}>
                    <Text style={[styles.bonusQtyCompact, { fontFamily, fontSize: baseFontSize - 3 }]}>
                      +{Number(bonus.__qty || 0)}
                    </Text>
                    <Text
                      style={[styles.bonusNameCompact, { fontFamily, fontSize: baseFontSize - 3 }]}
                      numberOfLines={2}>
                      {bonus.__name}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        );
      })}

      {/* Bonos sin vínculo directo */}
      {hasBonuses && (bonusesByLink.get('__unlinked__') || []).length > 0 && (
        <View style={styles.unlinkedBonusBox}>
          <Text style={[styles.unlinkedBonusTitle, { fontFamily, fontSize: baseFontSize - 3 }]}>
            🎁 Bonificaciones adicionales
          </Text>
          {(bonusesByLink.get('__unlinked__') || []).map((bonus, idx) => (
            <Text key={`unlinked_${idx}`} style={[styles.unlinkedBonusText, { fontFamily, fontSize: baseFontSize - 3 }]}>
              +{Number(bonus.__qty || 0)} {bonus.__name}
            </Text>
          ))}
        </View>
      )}

      <View style={styles.divider} />

      {/* Resumen financiero */}
      <View style={styles.totalRow}>
        <Text style={[styles.subTotalLabel, { fontFamily, fontSize: baseFontSize }]}>Subtotal:</Text>
        <Text style={[styles.subTotalValue, { fontFamily, fontSize: baseFontSize }]}>
          C${summary.subtotalNoDiscounts.toFixed(2)}
        </Text>
      </View>

      {summary.manualDiscount > 0 && (
        <View style={styles.totalRow}>
          <Text style={[styles.discountLabel, { fontFamily, fontSize: baseFontSize }]}>Desc. manual:</Text>
          <Text style={[styles.discountValue, { fontFamily, fontSize: baseFontSize }]}>
            -C${summary.manualDiscount.toFixed(2)}
          </Text>
        </View>
      )}
      {summary.categoryDiscount > 0 && (
        <View style={styles.totalRow}>
          <Text style={[styles.discountLabel, { fontFamily, fontSize: baseFontSize }]}>Desc. categoría:</Text>
          <Text style={[styles.discountValue, { fontFamily, fontSize: baseFontSize }]}>
            -C${summary.categoryDiscount.toFixed(2)}
          </Text>
        </View>
      )}
      {summary.customerDiscount > 0 && (
        <View style={styles.totalRow}>
          <Text style={[styles.discountLabel, { fontFamily, fontSize: baseFontSize }]}>Desc. cliente:</Text>
          <Text style={[styles.discountValue, { fontFamily, fontSize: baseFontSize }]}>
            -C${summary.customerDiscount.toFixed(2)}
          </Text>
        </View>
      )}
      {summary.discountsTotal > 0 && (
        <View style={[styles.totalRow, styles.savingsTotalRow]}>
          <Text style={[styles.savingsTotalLabel, { fontFamily, fontSize: baseFontSize - 1 }]}>
            Total ahorrado:
          </Text>
          <Text style={[styles.savingsTotalValue, { fontFamily, fontSize: baseFontSize - 1 }]}>
            -C${summary.discountsTotal.toFixed(2)}
          </Text>
        </View>
      )}

      <View style={styles.totalHighlight}>
        <Text style={[styles.totalLabel, { fontFamily, fontSize: baseFontSize + 4 }]}>TOTAL A PAGAR:</Text>
        <Text style={[styles.totalValue, { fontFamily, fontSize: baseFontSize + 4 }]}>
          C${summary.totalToPay.toFixed(2)}
        </Text>
      </View>

      <View style={styles.totalRow}>
        <Text style={[styles.subTotalLabel, { fontFamily, fontSize: baseFontSize }]}>Pagado:</Text>
        <Text style={[styles.subTotalValue, { fontFamily, fontSize: baseFontSize }]}>
          C${sale.amountPaid ? Number(sale.amountPaid).toFixed(2) : summary.totalToPay.toFixed(2)}
        </Text>
      </View>
      {Number(sale.change || 0) > 0 && (
        <View style={styles.totalRow}>
          <Text style={[styles.subTotalLabel, { fontFamily, fontSize: baseFontSize }]}>Cambio:</Text>
          <Text style={[styles.changeValue, { fontFamily, fontSize: baseFontSize }]}>
            C${Number(sale.change).toFixed(2)}
          </Text>
        </View>
      )}

      <View style={styles.divider} />

      <Text style={[styles.footer, { fontFamily, fontSize: baseFontSize - 2 }]}>
        ¡Gracias por su compra!
      </Text>
      {operator && (
        <Text style={[styles.footerOperator, { fontFamily, fontSize: baseFontSize - 3 }]}>
          Entregador: {operator}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#fff',
  },
  headerImage: { width: '100%', height: 70, marginBottom: 10 },
  header: { fontSize: 20, fontWeight: 'bold', textAlign: 'center', marginBottom: 4, color: '#111827' },
  subHeader: { fontSize: 14, textAlign: 'center', color: '#6B7280', marginBottom: 8 },
  ticketBadge: {
    alignSelf: 'center',
    backgroundColor: '#DBEAFE',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 4,
    marginBottom: 8,
  },
  ticketBadgeText: { fontWeight: '700', color: '#1D4ED8' },
  creditBanner: {
    alignSelf: 'center',
    backgroundColor: '#111827',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 6,
  },
  creditBannerText: { color: '#fff', fontWeight: '700' },
  divider: { height: 1, backgroundColor: '#E5E7EB', marginVertical: 10 },
  // Info
  label: { fontSize: 12, color: '#6B7280', marginBottom: 2 },
  value: { fontSize: 16, color: '#111827', marginBottom: 8, fontWeight: '500' },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 4 },
  operatorValue: { fontSize: 14, color: '#007AFF', fontWeight: '700', marginBottom: 8 },
  // Tabla
  row: { flexDirection: 'row', marginBottom: 4 },
  headerText: { fontSize: 12, fontWeight: 'bold', color: '#374151' },
  cellText: { fontSize: 14, color: '#111827' },
  // Ítem
  itemBox: { borderBottomWidth: 1, borderBottomColor: '#F1F5F9', paddingBottom: 8, marginBottom: 8 },
  itemMetaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  itemMetaText: { color: '#6B7280', flex: 1 },
  itemTag: { color: '#1D4ED8', fontWeight: '700', marginLeft: 8 },
  savingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
    backgroundColor: '#F0FDF4',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  savingsText: { color: '#16A34A', fontWeight: '700' },
  // Bonos
  bonusSummaryCard: {
    marginTop: 4,
    backgroundColor: '#F3E8FF',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  bonusSummaryTitle: { color: '#6D28D9', fontWeight: '800' },
  bonusSummaryKpi: { marginTop: 2, color: '#7C3AED', fontWeight: '600' },
  bonusItemCard: {
    marginTop: 6,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 4,
  },
  bonusItemHeader: { color: '#475569', fontWeight: '800' },
  bonusRowCompact: { flexDirection: 'row', alignItems: 'center' },
  bonusQtyCompact: { width: 38, color: '#6D28D9', fontWeight: '800' },
  bonusNameCompact: { flex: 1, color: '#334155', fontWeight: '600' },
  unlinkedBonusBox: {
    marginTop: 6,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  unlinkedBonusTitle: { color: '#9A3412', fontWeight: '800', marginBottom: 3 },
  unlinkedBonusText: { color: '#7C2D12', fontWeight: '600' },
  // Resumen
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  subTotalLabel: { fontSize: 14, color: '#374151' },
  subTotalValue: { fontSize: 14, color: '#111827', fontWeight: '600' },
  discountLabel: { fontSize: 14, color: '#DC2626' },
  discountValue: { fontSize: 14, color: '#DC2626', fontWeight: '700' },
  savingsTotalRow: {
    backgroundColor: '#F0FDF4',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginTop: 6,
  },
  savingsTotalLabel: { color: '#16A34A', fontWeight: '700' },
  savingsTotalValue: { color: '#16A34A', fontWeight: '800' },
  totalHighlight: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: 10,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  totalLabel: { fontSize: 18, fontWeight: 'bold', color: '#111827' },
  totalValue: { fontSize: 18, fontWeight: 'bold', color: '#2DCE89' },
  changeValue: { fontSize: 14, color: '#16A34A', fontWeight: '700' },
  // Footer
  footer: { marginTop: 16, textAlign: 'center', fontSize: 12, color: '#6B7280', fontStyle: 'italic' },
  footerOperator: { textAlign: 'center', marginTop: 3, color: '#9CA3AF' },
});

export default DeliveryTicket;
