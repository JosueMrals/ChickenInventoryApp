import React, { useMemo } from "react";
import { View, Text, Image, StyleSheet } from "react-native";
import Icon from "react-native-vector-icons/Ionicons";

// ── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (val) => `C$${(Number(val) || 0).toFixed(2)}`;

/** Devuelve el nombre/email del operador desde el objeto sale */
function getOperator(sale) {
  return (
    sale?.cashierName ||
    sale?.operatorName ||
    sale?.createdBy ||
    sale?.userEmail ||
    sale?.cashierEmail ||
    null
  );
}

/** Devuelve el creador original (quien abrió la preventa, puede diferir del cobrador) */
function getOriginalCreator(sale) {
  const creator = sale?.originalCreatedBy || sale?.preSaleCreatedBy || null;
  const operator = getOperator(sale);
  // Solo lo mostramos si es diferente al operador
  if (!creator || creator === operator) return null;
  return creator;
}

/** Nombre del cliente */
function getCustomerName(sale) {
  if (sale?.customer && typeof sale.customer === "object" && sale.customer.firstName) {
    return `${sale.customer.firstName} ${sale.customer.lastName || ""}`.trim();
  }
  return sale?.customerName || "Venta Rápida";
}

/** Etiqueta legible del método de pago */
function getPaymentLabel(sale) {
  const method = String(sale?.paymentMethod || "").toLowerCase();
  const map = {
    cash: "Efectivo",
    card: "Tarjeta",
    transfer: "Transferencia",
    credit: "Crédito",
    mixed: "Mixto",
    otro: "Otro",
  };
  return map[method] || sale?.paymentMethod || "—";
}

/** Ahorro total por ítem (manual + automático) */
function getItemSavings(item) {
  const manual = Number(item?.discount || 0);
  const auto = Number(item?.autoDiscountTotal || 0);
  return manual + auto;
}

/** Chips de pricing source */
function getItemChips(item) {
  const chips = [];
  const source = String(item?.pricingSource || "").toLowerCase();
  const savings = getItemSavings(item);

  if (source === "category") {
    const tiers = Number(item?.categoryDiscountTiersCount || 0);
    const labelExtra = tiers > 0 ? ` (${tiers} nivel${tiers !== 1 ? "es" : ""})` : "";
    chips.push({ text: `Desc. categoría${labelExtra}`, tone: "category" });
  }
  if (source === "wholesale") chips.push({ text: "Precio mayorista", tone: "wholesale" });
  if (source === "customer") chips.push({ text: "Desc. cliente", tone: "neutral" });
  if (Number(item?.discount || 0) > 0) chips.push({ text: "Desc. manual", tone: "manual" });

  return chips;
}

// ── Sub-componentes ───────────────────────────────────────────────────────────
const Chip = ({ text, tone = "neutral" }) => {
  const chipStyle = [
    styles.chip,
    tone === "category" && styles.chipCategory,
    tone === "wholesale" && styles.chipWholesale,
    tone === "manual" && styles.chipManual,
  ];
  const textStyle = [
    styles.chipText,
    tone === "category" && styles.chipTextCategory,
    tone === "wholesale" && styles.chipTextWholesale,
    tone === "manual" && styles.chipTextManual,
  ];
  return (
    <View style={chipStyle}>
      <Text style={textStyle}>{text}</Text>
    </View>
  );
};

const InfoRow = ({ label, value, valueStyle }) => (
  <View style={styles.infoRow}>
    <Text style={styles.infoLabel}>{label}</Text>
    <Text style={[styles.infoValue, valueStyle]}>{value}</Text>
  </View>
);

const DividerLabel = ({ label }) => (
  <View style={styles.dividerLabelRow}>
    <View style={styles.dividerLine} />
    <Text style={styles.dividerLabelText}>{label}</Text>
    <View style={styles.dividerLine} />
  </View>
);

// ── Componente principal ──────────────────────────────────────────────────────
/**
 * @param {object} props
 * @param {object} props.sale  - Documento de venta
 * @param {Array}  [props.bonuses=[]] - Bonificaciones desde inventoryMovements
 * @param {object} [props.ticketSettings] - Configuración de personalización del ticket
 *   { fontFamily, fontSize, headerImageUri, headerImageBase64, paperWidthMm }
 */
export default function SaleReceipt({ sale, bonuses = [], ticketSettings }) {
  if (!sale) return null;

  // Extrae configuración del ticket (con defaults)
  const ticketFont = ticketSettings?.fontFamily || undefined;
  const ticketFontSize = ticketSettings?.fontSize ? Number(ticketSettings.fontSize) : null;
  const ticketHeaderUri = ticketSettings?.headerImageUri
    ? ticketSettings.headerImageUri.startsWith('file://') ||
      ticketSettings.headerImageUri.startsWith('http')
      ? ticketSettings.headerImageUri
      : `file://${ticketSettings.headerImageUri}`
    : null;
  const ticketHeaderBase64 = ticketSettings?.headerImageBase64 || null;

  const saleDate =
    sale.createdAt && typeof sale.createdAt.toDate === "function"
      ? sale.createdAt.toDate()
      : new Date();

  const formattedDate = saleDate.toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  const formattedTime = saleDate.toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const { subtotal, manualDiscountTotal, categoryDiscountTotal, total, totalSavings } =
    useMemo(() => {
      const items = Array.isArray(sale.items) ? sale.items : [];
      const sub =
        Number(sale?.subtotal || 0) ||
        items.reduce(
          (s, it) => s + Number(it.quantity || 0) * Number(it.unitPrice || 0),
          0
        );
      const manual =
        Number(sale?.totalDiscount || sale?.discount || 0) ||
        items.reduce((s, it) => s + Number(it.discount || 0), 0);
      const catDisc =
        Number(sale?.categoryDiscountTotal || 0) ||
        items.reduce((s, it) => {
          if (String(it?.pricingSource || "").toLowerCase() !== "category") return s;
          return s + Number(it?.autoDiscountTotal || 0);
        }, 0);
      const tot = Number(sale?.total || 0) || sub - manual - catDisc;
      return {
        subtotal: sub,
        manualDiscountTotal: manual,
        categoryDiscountTotal: catDisc,
        total: tot,
        totalSavings: manual + catDisc,
      };
    }, [sale]);

  const operator = getOperator(sale);
  const originalCreator = getOriginalCreator(sale);

  // Bonificaciones: combina los del documento sale + los de inventoryMovements
  const saleBonuses = useMemo(
    () => Array.isArray(sale?.bonuses) ? sale.bonuses : [],
    [sale]
  );
  const allBonuses = useMemo(() => {
    // Mergeamos por productName+quantity para no duplicar
    const seen = new Set();
    const combined = [...saleBonuses, ...bonuses];
    return combined.filter((b) => {
      const key = `${b.productName || b.name}_${b.quantity}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [saleBonuses, bonuses]);

  // Helper para aplicar fuente personalizada a un estilo de texto
  const withFont = (baseStyle) => ({
    ...baseStyle,
    ...(ticketFont ? { fontFamily: ticketFont } : {}),
    ...(ticketFontSize ? { fontSize: baseStyle.fontSize ? baseStyle.fontSize + (ticketFontSize - 12) : ticketFontSize } : {}),
  });

  return (
    <View style={[styles.container, styles.content]}>
      {/* ── Imagen de cabecera personalizada ─────────────────────────────── */}
      {(ticketHeaderUri || ticketHeaderBase64) && (
        <Image
          source={
            ticketHeaderBase64
              ? { uri: `data:image/png;base64,${ticketHeaderBase64}` }
              : { uri: ticketHeaderUri }
          }
          style={styles.ticketHeaderImage}
          resizeMode="contain"
        />
      )}

      {/* ── Cabecera ─────────────────────────────────────────────────────── */}
      <View style={styles.headerBox}>
        <Icon name="checkmark-circle" size={44} color="#22C55E" />
        <Text style={withFont(styles.successTitle)}>Venta Exitosa</Text>
        <View style={styles.ticketBadge}>
          <Text style={withFont(styles.ticketBadgeText)}>
            Ticket #{sale.receiptNumber || sale.saleNumber || "N/A"}
          </Text>
        </View>
      </View>

      {/* ── Info de la venta ─────────────────────────────────────────────── */}
      <View style={styles.card}>
        <InfoRow label="Fecha" value={formattedDate} />
        <InfoRow label="Hora" value={formattedTime} />
        <View style={styles.cardDivider} />
        <InfoRow label="Cliente" value={getCustomerName(sale)} />
        <InfoRow label="Pago" value={getPaymentLabel(sale)} />
        {operator && (
          <InfoRow
            label="Atendido por"
            value={operator}
            valueStyle={styles.operatorValue}
          />
        )}
        {originalCreator && (
          <InfoRow
            label="Preventa creada por"
            value={originalCreator}
            valueStyle={styles.operatorSecondaryValue}
          />
        )}
      </View>

      {/* ── Productos ────────────────────────────────────────────────────── */}
      <DividerLabel label="PRODUCTOS VENDIDOS" />

      <View style={styles.card}>
        {(sale.items || []).map((item, index) => {
          const chips = getItemChips(item);
          const savings = getItemSavings(item);
          const isLast = index === (sale.items || []).length - 1;

          return (
            <View
              key={`item-${index}`}
              style={[styles.itemBlock, !isLast && styles.itemBlockBorder]}>
              {/* Nombre + total */}
              <View style={styles.itemTopRow}>
                <Text style={withFont(styles.itemName)} numberOfLines={2}>
                  {item.productName || item.name}
                </Text>
                <Text style={withFont(styles.itemTotal)}>{fmt(item.total)}</Text>
              </View>

              {/* Cantidad × precio unitario */}
              <Text style={withFont(styles.itemMeta)}>
                {item.quantity} unid. × {fmt(item.unitPrice)}
              </Text>

              {/* Chips de descuento / tipo */}
              {chips.length > 0 && (
                <View style={styles.chipsRow}>
                  {chips.map((chip, ci) => (
                    <Chip key={`${index}_${ci}`} text={chip.text} tone={chip.tone} />
                  ))}
                </View>
              )}

              {/* Ahorro por ítem */}
              {savings > 0 && (
                <View style={styles.savingsRow}>
                  <Icon name="arrow-down-circle-outline" size={12} color="#16A34A" />
                  <Text style={styles.savingsText}>Ahorro: -{fmt(savings)}</Text>
                </View>
              )}
            </View>
          );
        })}
      </View>

      {/* ── Bonificaciones ───────────────────────────────────────────────── */}
      {allBonuses.length > 0 && (
        <>
          <DividerLabel label="PRODUCTOS DE REGALO 🎁" />
          <View style={[styles.card, styles.bonusCard]}>
            {allBonuses.map((bonus, index) => {
              const isLast = index === allBonuses.length - 1;
              return (
                <View
                  key={`bonus-${index}`}
                  style={[styles.itemBlock, !isLast && styles.itemBlockBorder]}>
                  <View style={styles.itemTopRow}>
                    <View style={styles.bonusNameRow}>
                      <Icon name="gift-outline" size={14} color="#2563EB" />
                      <Text style={styles.bonusItemName}>
                        {bonus.productName || bonus.name}
                      </Text>
                    </View>
                    <View style={styles.bonusTag}>
                      <Text style={styles.bonusTagText}>GRATIS</Text>
                    </View>
                  </View>
                  <Text style={styles.itemMeta}>{bonus.quantity} unid. × C$0.00</Text>
                  {bonus.triggerProductName && (
                    <Text style={styles.bonusTrigger}>
                      Por compra de: {bonus.triggerProductName}
                    </Text>
                  )}
                </View>
              );
            })}
          </View>
        </>
      )}

      {/* ── Resumen financiero ───────────────────────────────────────────── */}
      <DividerLabel label="RESUMEN" />

      <View style={styles.card}>
        <View style={styles.summaryRow}>
          <Text style={withFont(styles.summaryLabel)}>Subtotal</Text>
          <Text style={withFont(styles.summaryValue)}>{fmt(subtotal)}</Text>
        </View>
        {manualDiscountTotal > 0 && (
          <View style={styles.summaryRow}>
            <Text style={withFont(styles.summaryLabel)}>Descuentos manuales</Text>
            <Text style={withFont(styles.summaryDiscount)}>-{fmt(manualDiscountTotal)}</Text>
          </View>
        )}
        {categoryDiscountTotal > 0 && (
          <View style={styles.summaryRow}>
            <Text style={withFont(styles.summaryLabel)}>Descuentos por categoría</Text>
            <Text style={withFont(styles.summaryDiscount)}>-{fmt(categoryDiscountTotal)}</Text>
          </View>
        )}
        {totalSavings > 0 && (
          <View style={[styles.summaryRow, styles.savingsTotalRow]}>
            <Text style={withFont(styles.savingsTotal)}>Total ahorrado</Text>
            <Text style={withFont(styles.savingsTotalValue)}>-{fmt(totalSavings)}</Text>
          </View>
        )}

        <View style={styles.totalLine} />

        <View style={styles.summaryTotalRow}>
          <Text style={withFont(styles.totalLabel)}>TOTAL</Text>
          <Text style={withFont(styles.totalValue)}>{fmt(total)}</Text>
        </View>

        {Number(sale.amountPaid || 0) > 0 && (
          <>
            <View style={styles.cardDivider} />
            <View style={styles.summaryRow}>
              <Text style={withFont(styles.summaryLabel)}>Monto pagado</Text>
              <Text style={withFont(styles.summaryValue)}>{fmt(sale.amountPaid)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={withFont(styles.summaryLabel)}>Cambio</Text>
              <Text style={[withFont(styles.summaryValue), { color: "#16A34A", fontWeight: "700" }]}>
                {fmt(sale.change)}
              </Text>
            </View>
          </>
        )}
      </View>

      {/* ── Pie de página ────────────────────────────────────────────────── */}
      <Text style={withFont(styles.footerText)}>¡Gracias por su compra!</Text>
      {operator && (
        <Text style={withFont(styles.footerOperator)}>Vendedor: {operator}</Text>
      )}
    </View>
  );
}

// ── Estilos ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { backgroundColor: "#fff" },
  content: { paddingVertical: 12, paddingHorizontal: 14, paddingBottom: 20 },

  // Imagen de cabecera del ticket
  ticketHeaderImage: {
    width: "100%",
    height: 80,
    resizeMode: "contain",
    marginBottom: 8,
  },

  // Header
  headerBox: {
    alignItems: "center",
    paddingVertical: 20,
    gap: 6,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#111827",
    marginTop: 4,
  },
  ticketBadge: {
    backgroundColor: "#DBEAFE",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 4,
    marginTop: 4,
  },
  ticketBadgeText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1D4ED8",
    letterSpacing: 0.5,
  },

  // Info card
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  bonusCard: {
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
  },
  cardDivider: {
    height: 1,
    backgroundColor: "#F3F4F6",
    marginVertical: 8,
  },

  // InfoRow
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingVertical: 5,
  },
  infoLabel: { fontSize: 13, color: "#6B7280", flex: 1 },
  infoValue: { fontSize: 13, fontWeight: "600", color: "#111827", flex: 2, textAlign: "right" },
  operatorValue: { color: "#007AFF", fontWeight: "700" },
  operatorSecondaryValue: { color: "#6B7280", fontWeight: "600" },

  // DividerLabel
  dividerLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 8,
    gap: 8,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: "#E5E7EB" },
  dividerLabelText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#9CA3AF",
    letterSpacing: 0.8,
  },

  // Items
  itemBlock: { paddingVertical: 10 },
  itemBlockBorder: { borderBottomWidth: 1, borderBottomColor: "#F3F4F6" },
  itemTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 8,
  },
  itemName: { fontSize: 14, fontWeight: "700", color: "#111827", flex: 1 },
  itemTotal: { fontSize: 14, fontWeight: "800", color: "#111827" },
  itemMeta: { fontSize: 12, color: "#6B7280", marginTop: 3 },
  chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 5, marginTop: 6 },

  // Chips
  chip: {
    backgroundColor: "#F1F5F9",
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  chipCategory: { backgroundColor: "#DBEAFE" },
  chipWholesale: { backgroundColor: "#F0FDF4" },
  chipManual: { backgroundColor: "#FEE2E2" },
  chipText: { fontSize: 10, fontWeight: "700", color: "#475569" },
  chipTextCategory: { color: "#1D4ED8" },
  chipTextWholesale: { color: "#16A34A" },
  chipTextManual: { color: "#B91C1C" },

  // Savings
  savingsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 5,
  },
  savingsText: { fontSize: 11, fontWeight: "700", color: "#16A34A" },

  // Bonuses
  bonusNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    flex: 1,
  },
  bonusItemName: { fontSize: 14, fontWeight: "700", color: "#1D4ED8", flex: 1 },
  bonusTag: {
    backgroundColor: "#2563EB",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  bonusTagText: { color: "#fff", fontSize: 10, fontWeight: "800", letterSpacing: 0.5 },
  bonusTrigger: { fontSize: 11, color: "#6B7280", marginTop: 3, fontStyle: "italic" },

  // Summary
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
  },
  summaryLabel: { fontSize: 13, color: "#6B7280" },
  summaryValue: { fontSize: 13, fontWeight: "600", color: "#111827" },
  summaryDiscount: { fontSize: 13, fontWeight: "700", color: "#DC2626" },
  savingsTotalRow: {
    backgroundColor: "#F0FDF4",
    borderRadius: 8,
    paddingHorizontal: 8,
    marginTop: 4,
  },
  savingsTotal: { fontSize: 12, fontWeight: "700", color: "#16A34A" },
  savingsTotalValue: { fontSize: 13, fontWeight: "800", color: "#16A34A" },
  totalLine: { height: 1, backgroundColor: "#E5E7EB", marginVertical: 10 },
  summaryTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  totalLabel: { fontSize: 18, fontWeight: "800", color: "#111827" },
  totalValue: { fontSize: 22, fontWeight: "800", color: "#111827" },

  // Footer
  footerText: {
    textAlign: "center",
    marginTop: 14,
    fontSize: 14,
    color: "#6B7280",
    fontWeight: "600",
  },
  footerOperator: {
    textAlign: "center",
    marginTop: 4,
    fontSize: 11,
    color: "#9CA3AF",
  },
});

