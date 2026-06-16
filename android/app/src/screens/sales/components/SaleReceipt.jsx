import React, { useMemo } from "react";
import { View, Text, Image, StyleSheet } from "react-native";
import { resolveUserDisplayName } from "../../../utils/userUtils";

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt = (val) => `C$${(Number(val) || 0).toFixed(2)}`;

function getCustomerName(sale) {
  if (sale?.customer && typeof sale.customer === "object" && sale.customer.firstName) {
    return `${sale.customer.firstName} ${sale.customer.lastName || ""}`.trim().toUpperCase();
  }
  return (sale?.customerName || "VENTA RÁPIDA").toUpperCase();
}

/** Vendedor: quien generó la pre-venta originalmente */
function getSeller(sale) {
  return (
    sale?.preSaleCreatedBy ||
    sale?.originalCreatedBy ||
    sale?.cashierName ||
    sale?.operatorName ||
    sale?.createdBy ||
    sale?.userEmail ||
    sale?.cashierEmail ||
    null
  );
}

/** Entregador: quien realizó la entrega/cobro */
function getDeliverer(sale) {
  return (
    sale?.deliveredBy ||
    sale?.collectedBy ||
    sale?.paidBy ||
    null
  );
}

// Encuentra las regalías que corresponden a un ítem específico
function getBonusesForItem(item, allBonuses) {
  return allBonuses.filter(
    (b) =>
      b.triggerProductName === (item.productName || item.name) ||
      b.triggerProductId === (item.productId || item.id)
  );
}

// ── Separador de guiones ──────────────────────────────────────────────────────
const Separator = ({ dashed = false }) => (
  <Text style={dashed ? styles.separatorDashed : styles.separatorSolid}>
    {dashed
      ? "- - - - - - - - - - - - - - - - - - - - - - - -"
      : "________________________________________________"}
  </Text>
);

// ── Componente principal ──────────────────────────────────────────────────────
export default function SaleReceipt({ sale, bonuses = [], ticketSettings, usersById = {} }) {
  if (!sale) return null;

  const ticketHeaderUri = ticketSettings?.headerImageUri
    ? ticketSettings.headerImageUri.startsWith("file://") ||
      ticketSettings.headerImageUri.startsWith("http")
      ? ticketSettings.headerImageUri
      : `file://${ticketSettings.headerImageUri}`
    : null;
  const ticketHeaderBase64 = ticketSettings?.headerImageBase64 || null;

  const saleDate =
    sale.createdAt && typeof sale.createdAt.toDate === "function"
      ? sale.createdAt.toDate()
      : new Date();

  const formattedDateTime = `${saleDate.toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "numeric",
    year: "numeric",
  })}, ${saleDate.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}`;

  // Mergeamos bonificaciones sin duplicados
  const saleBonuses = useMemo(
    () => (Array.isArray(sale?.bonuses) ? sale.bonuses : []),
    [sale]
  );
  const allBonuses = useMemo(() => {
    const seen = new Set();
    return [...saleBonuses, ...bonuses].filter((b) => {
      const key = `${b.productName || b.name}_${b.quantity}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [saleBonuses, bonuses]);

  // Bonificaciones sin ítem padre identificado (se listan al final)
  const orphanBonuses = useMemo(
    () =>
      allBonuses.filter(
        (b) =>
          !b.triggerProductName &&
          !b.triggerProductId
      ),
    [allBonuses]
  );

  // ── Totales desde el documento (ya incluyen todos los descuentos aplicados) ──────
  // sale.total = sum(item.total) = sum(qty × unitPrice − manualDiscount)
  // Usamos directamente el total del documento para garantizar coherencia con Firestore.
  const total = Number(sale?.total || 0);
  const amountPaid = Number(sale?.amountPaid || 0);
  const change = Number(sale?.change || 0);

  const seller = sale?.sellerDisplayName || resolveUserDisplayName(getSeller(sale), usersById);
  const deliverer = sale?.delivererDisplayName || resolveUserDisplayName(getDeliverer(sale), usersById);
  const receiptNumber =
    sale.receiptNumber || sale.saleNumber || sale.preSaleNumber || "N/A";

  return (
    <View style={styles.container}>
      {/* ── Logo / imagen de cabecera ──────────────────────────────────── */}
      {(ticketHeaderUri || ticketHeaderBase64) ? (
        <Image
          source={
            ticketHeaderBase64
              ? { uri: `data:image/png;base64,${ticketHeaderBase64}` }
              : { uri: ticketHeaderUri }
          }
          style={styles.headerImage}
          resizeMode="contain"
        />
      ) : null}

      {/* ── Tipo de ticket y número ────────────────────────────────────── */}
      <Text style={styles.ticketType}>TICKET DE ENTREGA</Text>
      <Text style={styles.ticketType}>PRE-VENTA #{receiptNumber}</Text>

      <Separator dashed />

      {/* ── Cliente y fecha ───────────────────────────────────────────── */}
      <View style={styles.metaRow}>
        <Text style={styles.metaLabel}>CLIENTE:</Text>
        <Text style={styles.metaValue}>{getCustomerName(sale)}</Text>
      </View>
      <View style={styles.metaRow}>
        <Text style={styles.metaLabel}>DIRECCIÓN:</Text>
        <Text style={styles.metaValue}>
          {(sale?.customer?.address || sale?.customerAddress || '').toUpperCase() || 'N/A'}
        </Text>
      </View>
      <View style={styles.metaRow}>
        <Text style={styles.metaLabel}>FECHA:</Text>
        <Text style={styles.metaValue}>{formattedDateTime}</Text>
      </View>

      <Separator dashed />

      {/* ── Encabezado de columnas ────────────────────────────────────── */}
      <View style={styles.colHeader}>
        <Text style={[styles.colHeaderText, { flex: 3 }]}>PRODUCTO</Text>
        <Text style={[styles.colHeaderText, { flex: 1, textAlign: "right" }]}>TOTAL</Text>
      </View>

      <Separator />

      {/* ── Ítems ─────────────────────────────────────────────────────── */}
      {(sale.items || []).map((item, index) => {
        const itemBonuses = getBonusesForItem(item, allBonuses);
        const qty = Number(item.quantity || item.qty || 0);
        const itemTotal = Number(item.total || 0);
        // Precio unitario efectivo: item.total / qty
        // Esto garantiza que qty × precio = total sin revelar descuentos
        const effectiveUnitPrice = qty > 0 ? itemTotal / qty : Number(item.unitPrice || 0);
        return (
          <View key={`item-${index}`} style={styles.itemBlock}>
            {/* Nombre + total en la misma línea */}
            <View style={styles.itemRow}>
              <Text style={styles.itemName} numberOfLines={2}>
                {(item.productName || item.name || "").toUpperCase()}
              </Text>
              <Text style={styles.itemTotal}>{fmt(itemTotal)}</Text>
            </View>
            {/* Cantidad × precio unitario efectivo (math siempre cuadra: qty × precio = total) */}
            <Text style={styles.itemMeta}>
              CANT: {qty} X {fmt(effectiveUnitPrice)}
            </Text>
            {/* Regalías vinculadas a este ítem */}
            {itemBonuses.map((bonus, bi) => (
              <Text key={`bonus-${index}-${bi}`} style={styles.bonusLine}>
                REGALO: {bonus.quantity} {(bonus.productName || bonus.name || "").toUpperCase()}
              </Text>
            ))}
          </View>
        );
      })}

      {/* ── Regalías sin ítem padre ───────────────────────────────────── */}
      {orphanBonuses.map((bonus, index) => (
        <View key={`orphan-${index}`} style={styles.itemBlock}>
          <View style={styles.itemRow}>
            <Text style={styles.itemName}>
              {(bonus.productName || bonus.name || "").toUpperCase()}
            </Text>
            <Text style={styles.itemTotal}>C$0.00</Text>
          </View>
          <Text style={styles.bonusLine}>
            REGALO: {bonus.quantity} UND.
          </Text>
        </View>
      ))}

      <Separator />

      {/* ── Totales ───────────────────────────────────────────────────── */}
      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>TOTAL A PAGAR:</Text>
        <Text style={styles.totalValue}>{fmt(total)}</Text>
      </View>

      {amountPaid > 0 && (
        <>
          <View style={styles.totalRow}>
            <Text style={styles.totalSubLabel}>PAGADO:</Text>
            <Text style={styles.totalSubValue}>{fmt(amountPaid)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalSubLabel}>CAMBIO:</Text>
            <Text style={styles.totalSubValue}>{fmt(change)}</Text>
          </View>
        </>
      )}

      <Separator dashed />

      {/* ── Vendedor / Entregador — solo en pie ──────────────────────── */}
      {(seller || deliverer) && (
        <View style={styles.staffRow}>
          {seller ? (
            <View style={styles.staffItem}>
              <Text style={styles.staffLabel}>VENDEDOR</Text>
              <Text style={styles.staffValue}>{seller.toUpperCase()}</Text>
            </View>
          ) : null}
          {deliverer ? (
            <View style={[styles.staffItem, seller ? styles.staffRight : null]}>
              <Text style={styles.staffLabel}>ENTREGADOR</Text>
              <Text style={styles.staffValue}>{deliverer.toUpperCase()}</Text>
            </View>
          ) : null}
        </View>
      )}

      {/* ── Pie ──────────────────────────────────────────────────────── */}
      <Text style={styles.footer}>GRACIAS POR SU COMPRA</Text>
    </View>
  );
}

// ── Estilos ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 14,
    paddingBottom: 24,
  },

  // Header image
  headerImage: {
    width: "100%",
    height: 90,
    resizeMode: "contain",
    marginBottom: 8,
  },

  // Ticket type
  ticketType: {
    fontFamily: "monospace",
    fontSize: 12,
    fontWeight: "700",
    color: "#111",
    textAlign: "center",
    letterSpacing: 0.5,
  },

  // Separadores
  separatorSolid: {
    fontFamily: "monospace",
    fontSize: 10,
    color: "#555",
    textAlign: "center",
    marginVertical: 4,
    letterSpacing: 0,
  },
  separatorDashed: {
    fontFamily: "monospace",
    fontSize: 10,
    color: "#888",
    textAlign: "center",
    marginVertical: 4,
  },

  // Meta (cliente, fecha)
  metaRow: {
    flexDirection: "row",
    marginVertical: 1,
  },
  metaLabel: {
    fontFamily: "monospace",
    fontSize: 11,
    fontWeight: "700",
    color: "#111",
    width: 80,
  },
  metaValue: {
    fontFamily: "monospace",
    fontSize: 11,
    color: "#111",
    flex: 1,
    flexWrap: "wrap",
  },

  // Encabezado de columnas
  colHeader: {
    flexDirection: "row",
    marginTop: 2,
  },
  colHeaderText: {
    fontFamily: "monospace",
    fontSize: 11,
    fontWeight: "800",
    color: "#111",
    letterSpacing: 0.5,
  },

  // Ítems
  itemBlock: {
    marginVertical: 5,
  },
  itemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  itemName: {
    fontFamily: "monospace",
    fontSize: 12,
    fontWeight: "700",
    color: "#111",
    flex: 3,
    flexWrap: "wrap",
  },
  itemTotal: {
    fontFamily: "monospace",
    fontSize: 12,
    fontWeight: "700",
    color: "#111",
    textAlign: "right",
    flex: 1,
  },
  itemMeta: {
    fontFamily: "monospace",
    fontSize: 11,
    color: "#333",
    marginTop: 1,
  },
  bonusLine: {
    fontFamily: "monospace",
    fontSize: 11,
    fontWeight: "700",
    color: "#111",
    marginTop: 2,
  },

  // Totales
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginVertical: 2,
  },
  totalLabel: {
    fontFamily: "monospace",
    fontSize: 13,
    fontWeight: "800",
    color: "#111",
  },
  totalValue: {
    fontFamily: "monospace",
    fontSize: 13,
    fontWeight: "800",
    color: "#111",
  },
  totalSubLabel: {
    fontFamily: "monospace",
    fontSize: 12,
    fontWeight: "700",
    color: "#333",
  },
  totalSubValue: {
    fontFamily: "monospace",
    fontSize: 12,
    fontWeight: "700",
    color: "#333",
  },

  // Footer
  footer: {
    fontFamily: "monospace",
    fontSize: 12,
    fontWeight: "700",
    color: "#111",
    textAlign: "center",
    marginTop: 8,
    letterSpacing: 1,
  },

  // Staff (vendedor / entregador) — solo en pie
  staffRow: {
    flexDirection: "row",
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  staffItem: {
    flex: 1,
    alignItems: "center",
  },
  staffRight: {
    borderLeftWidth: 1,
    borderLeftColor: "#E5E7EB",
  },
  staffLabel: {
    fontFamily: "monospace",
    fontSize: 9,
    color: "#9CA3AF",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  staffValue: {
    fontFamily: "monospace",
    fontSize: 10,
    fontWeight: "700",
    color: "#374151",
    textAlign: "center",
  },
});

