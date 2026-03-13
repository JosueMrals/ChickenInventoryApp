import React, { useContext, useMemo, useState, useEffect, useRef } from "react";
import { View, Text, TouchableOpacity, FlatList, Alert, SafeAreaView, ActivityIndicator, StyleSheet } from "react-native";
import Icon from "react-native-vector-icons/Ionicons";
import { PreSaleContext } from "./context/preSaleContext";
import { useRoute } from "../../context/RouteContext";
import CartItem from "../quicksalesNew/components/CartItem";
import DiscountModal from "../../components/common/DiscountModal";
import styles from "../quicksalesNew/styles/quickCartStyles";
import globalStyles from "../../styles/globalStyles";

const formatCurrency = (value) => `C$${(Number(value) || 0).toFixed(2)}`;
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
    submitPreSale, resetPreSale, loading, editingPreSale
  } = useContext(PreSaleContext);

  const { selectedRoute } = useRoute();
  const [discountModal, setDiscountModal] = useState({ visible: false, product: null });
  const [isCredit, setIsCredit] = useState(false);
  const creditWarningShownRef = useRef(false);
  const totalWarningShownRef = useRef(false);

  const isEditing = !!editingPreSale;
  const cartToDisplay = isEditing ? editCart : cart;
  const updateCartFn = isEditing ? updateEditCart : updateCart;
  const removeFromCartFn = isEditing ? removeFromEditCart : removeFromCart;

  const customerCreditLimit = Number(customer?.creditLimit) || 0;
  const canUseCredit = customerCreditLimit > 0;

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
  const creditExceeded = canUseCredit && total > customerCreditLimit;
  const creditAvailable = canUseCredit ? Math.max(customerCreditLimit - total, 0) : 0;

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
      if (total > customerCreditLimit) {
        return Alert.alert(
          "Crédito insuficiente",
          `El crédito permitido es C$${customerCreditLimit.toFixed(2)} y el total es C$${total.toFixed(2)}.`
        );
      }
    }

    try {
      await submitPreSale({ paymentMethod: isCredit ? 'credit' : 'cash' });
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
    }
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
                    Límite: {formatCurrency(customerCreditLimit)} · Disponible: {formatCurrency(creditAvailable)}
                  </Text>
                  {!hasValidTotal && (
                    <Text style={localStyles.creditWarning}>El total debe ser mayor que 0.</Text>
                  )}
                  {creditExceeded && (
                    <Text style={localStyles.creditWarning}>El total supera el límite permitido.</Text>
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
