import React, { useContext, useMemo, useState, useEffect, useRef } from "react";
import { View, Text, TouchableOpacity, FlatList, Alert, SafeAreaView, ActivityIndicator, StyleSheet } from "react-native";
import Icon from "react-native-vector-icons/Ionicons";
import { PreSaleContext } from "./context/preSaleContext";
import { useRoute } from "../../context/RouteContext";
import CartItem from "../quicksalesNew/components/CartItem";
import DiscountModal from "../../components/common/DiscountModal";
import styles from "../quicksalesNew/styles/quickCartStyles";
import globalStyles from "../../styles/globalStyles";
import CreditDueDatePicker from "./components/CreditDueDatePicker";
import { getEffectiveCreditLimit, toDateSafe } from "../../utils/creditUtils";
import { useCreditExposure } from "../../hooks/useCreditExposure";
import { useSubmitLock } from "../../hooks/useSubmitLock";
import { formatCurrency } from "../../utils/formatMoney";

const roundTo2 = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

const formatPreSaleError = (error) => {
  const message = error?.message || '';
  if (message.startsWith('Stock insuficiente')) {
    return `${message}. Ajusta cantidades o elimina el producto.`;
  }
  if (message.startsWith('Producto no encontrado')) {
    return 'No se pudo validar el stock de un producto. Intenta nuevamente.';
  }
  return `No se pudo guardar la pre-venta. ${message}`.trim();
};

export default function PreSaleCartScreen({ navigation }) {
  const { 
    cart, updateCart, removeFromCart,
    editCart, updateEditCart, removeFromEditCart,
    customer, setCustomer,
    submitPreSale, resetPreSale, loading: contextLoading, editingPreSale
  } = useContext(PreSaleContext);

  // El `loading` del contexto llega tarde para frenar un doble toque (solo cambia
  // tras el re-render). El cerrojo por ref sí bloquea el segundo tap al instante.
  const { submitting, runLocked } = useSubmitLock();
  const loading = contextLoading || submitting;

  const { selectedRoute } = useRoute();
  const [discountModal, setDiscountModal] = useState({ visible: false, product: null });
  const [isCredit, setIsCredit] = useState(false);
  // Fecha de pago acordada; en edición se precarga la de la preventa.
  const [creditDueDate, setCreditDueDate] = useState(null);
  const creditWarningShownRef = useRef(false);
  const totalWarningShownRef = useRef(false);

  const isEditing = !!editingPreSale;
  const cartToDisplay = isEditing ? editCart : cart;
  const updateCartFn = isEditing ? updateEditCart : updateCart;
  const removeFromCartFn = isEditing ? removeFromEditCart : removeFromCart;

  // Límite efectivo: límite base + sobregiro configurado en el cliente.
  const effectiveCredit = getEffectiveCreditLimit(customer);
  const customerCreditLimit = effectiveCredit.total;
  const canUseCredit = customerCreditLimit > 0;

  useEffect(() => {
    if (editingPreSale?.paymentMethod === 'credit') {
      setIsCredit(true);
      setCreditDueDate(toDateSafe(editingPreSale.creditDueDate));
    }
  }, [editingPreSale]);

  const displayData = useMemo(() => {
    const normalItems = cartToDisplay.filter(i => !i.isBonus);
    const bonusItems = cartToDisplay.filter(i => i.isBonus);
    const result = [];

    normalItems.forEach(item => {
        result.push(item);
        // Buscar bonificaciones vinculadas a este item
        const myBonuses = bonusItems.filter(b => b.linkedTo === item.id);
        result.push(...myBonuses);
    });

    // Casos borde: bonificaciones huérfanas o sin link (no deberían existir, pero por seguridad)
    const linkedBonusIds = new Set(result.filter(i => i.isBonus).map(i => i.id));
    const orphanBonuses = bonusItems.filter(b => !linkedBonusIds.has(b.id));
    result.push(...orphanBonuses);

    return result;
  }, [cartToDisplay]);

  const soldItems = useMemo(() => cartToDisplay.filter(item => !item.isBonus), [cartToDisplay]);

  const subtotal = useMemo(() => 
    soldItems.reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0), 0), 
    [soldItems]
  );
  const totalDiscount = useMemo(() => 
    soldItems.reduce((sum, item) => sum + (Number(item.discount) || 0), 0), 
    [soldItems]
  );
  const categoryAutoDiscount = useMemo(() => {
    const byCategory = soldItems.reduce((acc, item) => {
      if (item.pricingSource !== 'category') return acc;
      const categoryKey = String(item?.product?.category || 'sin_categoria').toLowerCase();
      acc[categoryKey] = (acc[categoryKey] || 0) + (Number(item.autoDiscountTotal) || 0);
      return acc;
    }, {});

    return Object.values(byCategory).reduce((sum, value) => sum + roundTo2(value), 0);
  }, [soldItems]
  );
  const total = subtotal - totalDiscount;
  const showSummaryBreakdown = totalDiscount > 0;
  const hasValidTotal = Number.isFinite(total) && total > 0;
  // El tope se aplica sobre la exposición TOTAL (deuda vigente + esta venta), no
  // solo sobre el total de la venta: antes un cliente al borde de su límite podía
  // superarlo tantas veces como facturas distintas se le hicieran.
  const creditExposure = useCreditExposure(customer, total);
  const creditExceeded = creditExposure.exceeded;
  const creditAvailable = creditExposure.available;

  useEffect(() => {
    if (!hasValidTotal) {
      if (isCredit && !totalWarningShownRef.current) {
        Alert.alert('Total inválido', 'El total debe ser mayor que 0 para usar crédito.');
        totalWarningShownRef.current = true;
      }
      setIsCredit(false);
      return;
    }

    totalWarningShownRef.current = false;
  }, [hasValidTotal, isCredit]);

  useEffect(() => {
    if (!canUseCredit || creditExceeded) {
      if (isCredit && !creditWarningShownRef.current) {
        Alert.alert('Crédito desactivado', 'El crédito no está disponible o el total supera el límite.');
        creditWarningShownRef.current = true;
      }
      setIsCredit(false);
      return;
    }

    creditWarningShownRef.current = false;
  }, [canUseCredit, creditExceeded, isCredit]);

  const handleSubmit = async () => {
    if (cartToDisplay.length === 0) return Alert.alert("Carrito vacío", "Agrega productos antes de continuar.");
    if (!hasValidTotal) return Alert.alert('Total inválido', 'El total debe ser mayor que 0.');

    if (!selectedRoute && !isEditing) { // En edición, la ruta ya está guardada
        return Alert.alert(
            "Ruta no seleccionada",
            "No se ha detectado una ruta activa. Por favor, selecciona una ruta desde el menú principal.",
            [{ text: "OK" }]
        );
    }

    if (!customer) {
      return Alert.alert("Cliente no asignado", "Por favor, asigna un cliente a esta pre-venta.", [
        { text: "Cancelar", style: "cancel" },
        { text: "Asignar", onPress: () => navigation.navigate('AssignCustomer') }
      ]);
    }

    if (isCredit) {
      if (!canUseCredit) {
        return Alert.alert("Crédito no disponible", "Este cliente no tiene crédito habilitado.");
      }
      // Mientras la consulta esté en vuelo no se sabe si el saldo es 0 o si no se
      // pudo leer: confirmar aquí se saltaría el tope acumulado.
      if (creditExposure.loading) {
        return Alert.alert(
          "Verificando saldo",
          "Estamos consultando la deuda del cliente. Intenta de nuevo en un momento."
        );
      }
      if (creditExposure.exceeded) {
        return Alert.alert(
          "Crédito insuficiente",
          creditExposure.verified
            ? `Este cliente ya debe ${formatCurrency(creditExposure.outstanding)} y su límite es ${formatCurrency(customerCreditLimit)}.\n\nCon esta venta de ${formatCurrency(total)} lo superaría. Debe abonar antes de llevar más crédito.`
            : `El crédito permitido es ${formatCurrency(customerCreditLimit)} y el total es ${formatCurrency(total)}.`
        );
      }
      if (!creditDueDate) {
        return Alert.alert(
          "Fecha de pago requerida",
          "Selecciona la fecha en la que el cliente se compromete a pagar el crédito."
        );
      }
    }

    // runLocked: descarta el segundo toque. Sin esto se creaban DOS preventas,
    // con doble descuento de inventario.
    return runLocked(async () => {
      try {
        await submitPreSale({
          paymentMethod: isCredit ? 'credit' : 'cash',
          creditDueDate: isCredit ? creditDueDate : null,
        });
        Alert.alert(
          isEditing ? "Pre-Venta Actualizada" : "Pre-Venta Guardada",
          isEditing ? "Los cambios han sido guardados." : `La pre-venta ha sido creada exitosamente para la ruta: ${selectedRoute.name}`,
          [{ text: "OK", onPress: () => {
              resetPreSale();
              // Navega a la lista, asegurando que se actualice.
              navigation.navigate("PreSalesList", { refresh: true });
          }}]
        );
      } catch (error) {
        Alert.alert("Error", formatPreSaleError(error));
        throw error;
      }
    }, { keepLockedOnSuccess: true }).catch(() => {});
  };

  const openDiscount = (item) => {
    if (item.isBonus) return;
    setDiscountModal({ visible: true, product: item });
  };
  
  const applyDiscountToProduct = ({ discountType, discountValue }) => {
    const product = discountModal.product;
    if (!product) return;

    let finalDiscount = 0;
    const productTotal = product.quantity * product.unitPrice;

    if (discountType === 'percent') {
      finalDiscount = (productTotal * discountValue) / 100;
    } else if (discountType === 'amount') {
      finalDiscount = discountValue;
    }

    if (finalDiscount > productTotal) {
      finalDiscount = productTotal;
    }

    updateCartFn(product.id, {
      discount: finalDiscount,
      discountType,
      discountValue,
    });
    
    setDiscountModal({ visible: false, product: null });
  };

  return (
    <SafeAreaView style={globalStyles.container}>
        <View style={styles.container}>
          <View style={globalStyles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <Icon name="chevron-back" size={26} color="#fff" />
            </TouchableOpacity>
            <Text style={globalStyles.title}>{isEditing ? "Editar Pre-Venta" : "Carrito de Pre-Venta"}</Text>
            <View style={{ width: 40 }} />
          </View>

          <View style={{ paddingHorizontal: 16, marginBottom: 10 }}>
            {customer ? (
                <View style={[styles.customerBox, { marginBottom: 8 }]}>
                  <Icon name="person" size={18} color="#007AFF" />
                  <Text style={styles.customerText}>{customer.firstName} {customer.lastName}</Text>
                  <TouchableOpacity onPress={() => setCustomer(null)} style={{ marginLeft: 8 }}>
                      <Icon name="close" size={20} color="#FF3B30" />
                  </TouchableOpacity>
                </View>
            ) : (
                <TouchableOpacity
                    style={[styles.customerBox, { borderStyle: 'dashed', backgroundColor: '#f9f9f9' }]}
                    onPress={() => navigation.navigate('AssignCustomer')}
                >
                    <Icon name="person-add-outline" size={18} color="#666" />
                    <Text style={[styles.customerText, { color: '#666' }]}>Asignar Cliente</Text>
                </TouchableOpacity>
            )}

            {selectedRoute && (
                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#E1F0FF', padding: 8, borderRadius: 8 }}>
                    <Icon name="location-sharp" size={16} color="#007AFF" style={{ marginRight: 6 }} />
                    <Text style={{ fontSize: 13, color: '#004488', fontWeight: '600' }}>
                        Ruta Actual: {selectedRoute.name}
                    </Text>
                </View>
            )}
          </View>

          <FlatList
            data={displayData}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <CartItem
                item={item}
                onDiscount={() => openDiscount(item)}
                onRemove={() => removeFromCartFn(item.id)}
                onUpdate={(changes) => updateCartFn(item.id, changes)}
              />
            )}
            ListEmptyComponent={() => (
              <View style={styles.emptyBox}><Text style={styles.emptyText}>No hay productos</Text></View>
            )}
            contentContainerStyle={{ paddingBottom: 250 }}
          />

          <View style={styles.summary}>
            {showSummaryBreakdown && (
              <>
                <View style={styles.row}><Text style={styles.label}>Subtotal</Text><Text style={styles.value}>{formatCurrency(subtotal)}</Text></View>
                <View style={styles.row}><Text style={styles.label}>Descuentos</Text><Text style={styles.value}>-{formatCurrency(totalDiscount)}</Text></View>
              </>
            )}
            {categoryAutoDiscount > 0 && (
              <View style={styles.row}>
                <Text style={styles.label}>Desc. categoria aplicado</Text>
                <Text style={styles.value}>{formatCurrency(categoryAutoDiscount)}</Text>
              </View>
            )}
            <View style={styles.rowTotal}><Text style={styles.totalLabel}>Total</Text><Text style={styles.totalValue}>{formatCurrency(total)}</Text></View>

            {canUseCredit && (
              <View style={localStyles.paymentRow}>
                <View style={localStyles.creditInfo}>
                  <Text style={localStyles.paymentLabel}>Crédito</Text>
                  <Text style={localStyles.creditHint}>
                    Límite: {formatCurrency(customerCreditLimit)}
                    {effectiveCredit.extra > 0 ? ` (incluye sobregiro ${formatCurrency(effectiveCredit.extra)})` : ''}
                    {creditExposure.verified && creditExposure.outstanding > 0
                      ? `${' · '}Ya debe: ${formatCurrency(creditExposure.outstanding)}`
                      : ''}
                    {' · '}Disponible: {formatCurrency(creditAvailable)}
                  </Text>
                  {!hasValidTotal && (
                    <Text style={localStyles.creditWarning}>El total debe ser mayor que 0.</Text>
                  )}
                  {creditExceeded && (
                    <Text style={localStyles.creditWarning}>
                      {creditExposure.verified
                        ? 'Con su deuda actual, esta venta supera el límite permitido.'
                        : 'El total supera el límite permitido.'}
                    </Text>
                  )}
                  {/* Sin señal no se puede leer la deuda vigente: se valida solo
                      contra el total de la venta y se avisa, en vez de aparentar
                      un cupo disponible que no está verificado. */}
                  {!creditExposure.verified && !creditExposure.loading && (
                    <Text style={localStyles.creditWarning}>
                      Sin conexión: no se pudo verificar la deuda actual del cliente.
                    </Text>
                  )}
                </View>
                <TouchableOpacity
                  style={[
                    localStyles.creditChip,
                    isCredit && localStyles.creditChipActive,
                    (!hasValidTotal || creditExceeded) && localStyles.creditChipDisabled,
                  ]}
                  onPress={() => setIsCredit((prev) => !prev)}
                  disabled={!hasValidTotal || creditExceeded}
                >
                  <Icon name={isCredit ? "checkmark-circle" : "ellipse-outline"} size={14} color={isCredit ? "#fff" : "#666"} />
                  <Text style={[localStyles.creditChipText, isCredit && localStyles.creditChipTextActive]}>
                    {isCredit ? 'Activado' : 'Activar'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {isCredit && (
              <CreditDueDatePicker value={creditDueDate} onChange={setCreditDueDate} />
            )}

            <TouchableOpacity style={[styles.checkoutBtn, loading && styles.disabledButton]} onPress={handleSubmit} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.checkoutText}>{isEditing ? "Actualizar" : "Guardar"} Pre-Venta</Text>}
            </TouchableOpacity>
          </View>

          <DiscountModal
            visible={discountModal.visible}
            product={discountModal.product}
            onClose={() => setDiscountModal({ visible: false, product: null })}
            onApply={applyDiscountToProduct}
          />
        </View>
    </SafeAreaView>
  );
}

const localStyles = StyleSheet.create({
  paymentRow: {
    marginTop: 8,
    marginBottom: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  creditInfo: {
    flex: 1,
    marginRight: 8,
  },
  creditHint: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
  },
  creditWarning: {
    fontSize: 11,
    color: '#C0392B',
    marginTop: 2,
    fontWeight: '600',
  },
  paymentLabel: {
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
  },
  creditChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    backgroundColor: '#F5F6FA',
    gap: 6,
  },
  creditChipActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  creditChipDisabled: {
    opacity: 0.5,
  },
  creditChipText: {
    color: '#333',
    fontWeight: '700',
    fontSize: 12,
  },
  creditChipTextActive: {
    color: '#fff',
  },
});
