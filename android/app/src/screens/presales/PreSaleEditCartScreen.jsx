import React, { useContext, useMemo, useState, useEffect, useRef } from "react";
import { View, Text, TouchableOpacity, FlatList, Alert, SafeAreaView, ActivityIndicator, StyleSheet } from "react-native";
import Icon from "react-native-vector-icons/Ionicons";
import { PreSaleContext } from "./context/preSaleContext";
import CartItem from "../quicksalesNew/components/CartItem";
import DiscountModal from "../../components/common/DiscountModal";
import styles from "../quicksalesNew/styles/quickCartStyles";
import globalStyles from "../../styles/globalStyles";
import AddProductModal from "./components/AddProductModal";
import CreditDueDatePicker from "./components/CreditDueDatePicker";
import { getEffectiveCreditLimit, toDateSafe } from "../../utils/creditUtils";
import { useSubmitLock } from "../../hooks/useSubmitLock";

const formatCurrency = (value) => `C$${(Number(value) || 0).toFixed(2)}`;

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

export default function PreSaleEditCartScreen({ navigation }) {
  const { 
    customer, setCustomer, 
    submitPreSale, resetPreSale, loading: contextLoading,
    editCart, updateEditCart, removeFromEditCart, addItemToEditCart,
    editingPreSale
  } = useContext(PreSaleContext);

  // Ver useSubmitLock: `disabled` llega tarde para frenar un doble toque.
  const { submitting, runLocked } = useSubmitLock();
  const loading = contextLoading || submitting;
  
  const allowExitRef = useRef(false);
  const [discountModal, setDiscountModal] = useState({ visible: false, product: null });
  const [addProductModalVisible, setAddProductModalVisible] = useState(false);
  const [isCredit, setIsCredit] = useState(false);
  const [creditDueDate, setCreditDueDate] = useState(null);
  const creditWarningShownRef = useRef(false);

  // Precargar la fecha de pago ya acordada en la preventa que se edita.
  useEffect(() => {
    setCreditDueDate(toDateSafe(editingPreSale?.creditDueDate));
  }, [editingPreSale]);

  const displayData = useMemo(() => {
    const normalItems = editCart.filter(i => !i.isBonus);
    const bonusItems = editCart.filter(i => i.isBonus);
    const result = [];

    normalItems.forEach(item => {
        result.push(item);
        // Buscar bonificaciones vinculadas a este item
        const myBonuses = bonusItems.filter(b => b.linkedTo === item.id);
        result.push(...myBonuses);
    });

    // Casos borde
    const linkedBonusIds = new Set(result.filter(i => i.isBonus).map(i => i.id));
    const orphanBonuses = bonusItems.filter(b => !linkedBonusIds.has(b.id));
    result.push(...orphanBonuses);

    return result;
  }, [editCart]);

  const soldItems = useMemo(() => editCart.filter(item => !item.isBonus), [editCart]);

  const subtotal = useMemo(() => 
    soldItems.reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0), 0), 
    [soldItems]
  );
  const totalDiscount = useMemo(() => 
    soldItems.reduce((sum, item) => sum + (Number(item.discount) || 0), 0), 
    [soldItems]
  );
  const total = subtotal - totalDiscount;
  const showSummaryBreakdown = totalDiscount > 0;
  // Límite efectivo: límite base + sobregiro configurado en el cliente.
  const effectiveCredit = getEffectiveCreditLimit(customer);
  const customerCreditLimit = effectiveCredit.total;
  const canUseCredit = customerCreditLimit > 0;
  const creditExceeded = canUseCredit && total > customerCreditLimit;
  const creditAvailable = canUseCredit ? Math.max(customerCreditLimit - total, 0) : 0;
  const hasValidTotal = Number.isFinite(total) && total > 0;
  const preSaleIsCredit = editingPreSale?.paymentMethod === 'credit' || editingPreSale?.status === 'credit_pending';

  useEffect(() => {
    if (preSaleIsCredit && hasValidTotal && canUseCredit && !creditExceeded) {
      setIsCredit(true);
      return;
    }

    if (!preSaleIsCredit) {
      setIsCredit(false);
    }
  }, [preSaleIsCredit, hasValidTotal, canUseCredit, creditExceeded]);

  useEffect(() => {
    if (!hasValidTotal || !canUseCredit || creditExceeded) {
      if (isCredit && !creditWarningShownRef.current) {
        Alert.alert(
          'Crédito desactivado',
          'El crédito no está disponible o el total supera el límite. Se guardará como contado.'
        );
        creditWarningShownRef.current = true;
      }
      setIsCredit(false);
      return;
    }

    creditWarningShownRef.current = false;
  }, [hasValidTotal, canUseCredit, creditExceeded, isCredit]);

  const handleSubmit = async () => {
    if (editCart.length === 0) return Alert.alert("Carrito vacío", "Agrega productos antes de continuar.");
    if (!hasValidTotal) return Alert.alert('Total inválido', 'El total debe ser mayor que 0.');
    if (!customer) {
      return Alert.alert("Cliente no asignado", "Por favor, asigna un cliente a esta pre-venta.", [
        { text: "Cancelar", style: "cancel" },
        { text: "Asignar", onPress: () => navigation.navigate('AssignCustomer') }
      ]);
    }

    const mustForceCash = preSaleIsCredit && (!hasValidTotal || !canUseCredit || creditExceeded);
    if (mustForceCash) {
      Alert.alert(
        'Crédito desactivado',
        'El total supera el límite o el crédito no está disponible. Se guardará como contado.'
      );
    }

    if (preSaleIsCredit && !isCredit && !mustForceCash) {
      const confirm = await new Promise((resolve) => {
        Alert.alert(
          'Cambiar a contado',
          'El crédito está desactivado. ¿Deseas guardar esta pre-venta como contado?',
          [
            { text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
            { text: 'Guardar', onPress: () => resolve(true) },
          ]
        );
      });

      if (!confirm) return;
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
      if (!creditDueDate) {
        return Alert.alert(
          "Fecha de pago requerida",
          "Selecciona la fecha en la que el cliente se compromete a pagar el crédito."
        );
      }
    }

    const paymentMethod = mustForceCash ? 'cash' : (isCredit ? 'credit' : 'cash');

    return runLocked(async () => {
      try {
        await submitPreSale({
          paymentMethod,
          creditDueDate: paymentMethod === 'credit' ? creditDueDate : null,
        });
        Alert.alert("Pre-Venta Actualizada", "Los cambios han sido guardados.", [
          { text: "OK", onPress: () => {
              allowExitRef.current = true;
              resetPreSale();
              navigation.navigate("PreSalesList");
          }}
        ]);
      } catch (error) {
        Alert.alert("Error", formatPreSaleError(error));
        throw error;
      }
    }, { keepLockedOnSuccess: true }).catch(() => {});
  };

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      if (allowExitRef.current) {
        // Salida permitida (ej: después de guardar)
        return;
      }

      e.preventDefault();

      Alert.alert(
        '¿Descartar cambios?',
        'Si sales ahora, se perderán los cambios de esta edición.',
        [
          { text: 'Seguir editando', style: 'cancel', onPress: () => {} },
          {
            text: 'Salir sin guardar',
            style: 'destructive',
            onPress: () => {
              // Limpiar datos de edición antes de salir
              resetPreSale();
              navigation.dispatch(e.data.action);
            }
          }
        ]
      );
    });

    return unsubscribe;
  }, [navigation, resetPreSale]);

  const openDiscount = (item) => {
    if (item.isBonus) return;
    setDiscountModal({ visible: true, product: item });
  };
  
  const applyDiscountToProduct = ({ discountType, discountValue }) => {
    const product = discountModal.product;
    if (!product) return;
    let finalDiscount = 0;
    const productTotal = product.quantity * product.unitPrice;

    if (discountType === 'percent') finalDiscount = (productTotal * discountValue) / 100;
    else if (discountType === 'amount') finalDiscount = discountValue;
    if (finalDiscount > productTotal) finalDiscount = productTotal;

    updateEditCart(product.id, { discount: finalDiscount, discountType, discountValue });
    setDiscountModal({ visible: false, product: null });
  };

  const handleToggleProduct = (product) => {
      const isInCart = editCart.some(item => item.id === product.id);
      if (isInCart) {
          removeFromEditCart(product.id);
      } else {
          addItemToEditCart(product, 1);
      }
  };
  
  return (
    <SafeAreaView style={globalStyles.container}>
        <View style={globalStyles.container}>
          <View style={globalStyles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <Icon name="chevron-back" size={26} color="#fff" />
            </TouchableOpacity>
            <Text style={globalStyles.title}>Editando Pre-Venta</Text>
            <View style={{ width: 40 }}/>
          </View>

          {customer && (
            <View style={styles.customerBox}>
              <Icon name="person" size={18} color="#007AFF" />
              <Text style={styles.customerText}>{customer.firstName} {customer.lastName}</Text>
              <TouchableOpacity onPress={() => setCustomer(null)} style={{ marginLeft: 8 }}>
                <Icon name="close" size={20} color="#FF3B30" />
              </TouchableOpacity>
            </View>
          )}

          <FlatList
            data={displayData}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <CartItem
                item={item}
                onDiscount={() => openDiscount(item)}
                onRemove={() => removeFromEditCart(item.id)}
                onUpdate={(changes) => updateEditCart(item.id, changes)}
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
            <View style={styles.rowTotal}><Text style={styles.totalLabel}>Total</Text><Text style={styles.totalValue}>{formatCurrency(total)}</Text></View>

            {canUseCredit && (
              <View style={localStyles.paymentRow}>
                <View style={localStyles.creditInfo}>
                  <Text style={localStyles.paymentLabel}>Crédito</Text>
                  <Text style={localStyles.creditHint}>
                    Límite: {formatCurrency(customerCreditLimit)}
                    {effectiveCredit.extra > 0 ? ` (incluye sobregiro ${formatCurrency(effectiveCredit.extra)})` : ''}
                    {' · '}Disponible: {formatCurrency(creditAvailable)}
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

            {isCredit && (
              <CreditDueDatePicker value={creditDueDate} onChange={setCreditDueDate} />
            )}

            <View style={localStyles.footerButtons}>
              <TouchableOpacity style={[styles.checkoutBtn, {flex: 1, marginRight: 5, backgroundColor: '#007AFF'}]} onPress={() => setAddProductModalVisible(true)}>
                  <Text style={styles.checkoutText}>Agregar Producto</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.checkoutBtn, {flex: 1, marginLeft: 5}, loading && styles.disabledButton]} onPress={handleSubmit} disabled={loading}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.checkoutText}>Guardar Cambios</Text>}
              </TouchableOpacity>
            </View>
          </View>

          <DiscountModal
            visible={discountModal.visible}
            product={discountModal.product}
            onClose={() => setDiscountModal({ visible: false, product: null })}
            onApply={applyDiscountToProduct}
          />

          <AddProductModal 
            visible={addProductModalVisible}
            onClose={() => setAddProductModalVisible(false)}
            onAddProduct={handleToggleProduct}
            cart={editCart}
          />
        </View>
    </SafeAreaView>
  );
}

const localStyles = StyleSheet.create({
    footerButtons: { flexDirection: 'row', marginTop: 10 },
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