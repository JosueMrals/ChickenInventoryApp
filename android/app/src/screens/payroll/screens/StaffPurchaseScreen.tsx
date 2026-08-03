import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, TextInput, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { NavigationProp } from '@react-navigation/native';
import globalStyles from '../../../styles/globalStyles';
import styles, { COLORS, formatMoney } from '../styles/payrollStyles';
import ProductPickerRow from '../components/ProductPickerRow';
import StaffPickerModal from '../components/StaffPickerModal';
import { useStaffPurchaseCart } from '../hooks/useStaffPurchaseCart';
import { useSubmitLock } from '../../../hooks/useSubmitLock';
import { useAdaptiveBottom } from '../../../hooks/useAdaptiveBottom';
import { buildStaffName, createStaffPurchase, subscribeStaff } from '../services/payrollService';
import { StaffMember } from '../types';

interface Props {
  navigation: NavigationProp<any>;
  role?: string;
}

/**
 * Entrega de productos de bodega a un trabajador para uso personal.
 *
 * Es una venta directa sin cobro: descuenta inventario como cualquier salida,
 * pero en vez de pedir pago deja el monto cargado a la cuenta del trabajador
 * hasta que el admin cierre el periodo en Nómina.
 */
export default function StaffPurchaseScreen({ navigation, role }: Props) {
  const {
    products, loading, search, setSearch,
    quantities, changeQuantity, clear, items, total, totalUnits,
  } = useStaffPurchaseCart();

  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [selected, setSelected] = useState<StaffMember | null>(null);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const { runLocked } = useSubmitLock();
  const { bottomPadding } = useAdaptiveBottom();

  useEffect(() => {
    const unsubscribe = subscribeStaff(setStaff);
    return () => unsubscribe();
  }, []);

  const handleConfirm = useCallback(() => {
    if (!selected) {
      Alert.alert('Falta el trabajador', 'Selecciona a quién se le entregan los productos.');
      return;
    }
    if (items.length === 0) {
      Alert.alert('Sin productos', 'Agrega al menos un producto a la entrega.');
      return;
    }

    const detail = items.map((i) => `• ${i.quantity} × ${i.productName}`).join('\n');
    const staffName = buildStaffName(selected);

    Alert.alert(
      'Confirmar entrega',
      `${detail}\n\nTotal: ${formatMoney(total)}\n\nSe cargará a la cuenta de ${staffName} y se descontará de su próximo pago.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Entregar',
          onPress: () =>
            runLocked(async () => {
              setSaving(true);
              try {
                await createStaffPurchase({ uid: selected.uid, userName: staffName, items });
                Alert.alert(
                  'Entrega registrada',
                  `${formatMoney(total)} cargados a la cuenta de ${staffName}.`,
                );
                clear();
                setSelected(null);
              } catch (e: any) {
                Alert.alert('Error', e?.message || 'No se pudo registrar la entrega.');
              } finally {
                setSaving(false);
              }
            }).catch(() => {}),
        },
      ],
    );
  }, [selected, items, total, runLocked, clear]);

  // Gate de rol: la entrega descuenta inventario, así que la hace bodega (o admin).
  if (role && role !== 'admin' && role !== 'bodeguero') {
    return (
      <View style={styles.container}>
        <View style={globalStyles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Icon name="chevron-back" size={28} color="#FFF" />
          </TouchableOpacity>
          <Text style={globalStyles.title}>Entrega a Personal</Text>
          <View style={{ width: 28 }} />
        </View>
        <View style={styles.emptyState}>
          <Icon name="lock-closed-outline" size={48} color={COLORS.muted} />
          <Text style={styles.emptyText}>Solo bodega puede entregar productos al personal.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={globalStyles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="chevron-back" size={28} color="#FFF" />
        </TouchableOpacity>
        <Text style={globalStyles.title}>Entrega a Personal</Text>
        <View style={{ width: 28 }} />
      </View>

      {/* Trabajador que recibe */}
      <TouchableOpacity
        style={[styles.sectionCard, { marginHorizontal: 16, marginBottom: 10 }]}
        onPress={() => setPickerVisible(true)}
        activeOpacity={0.75}
      >
        <View style={styles.sectionHeader}>
          <Icon name="person-outline" size={17} color={COLORS.accent} />
          <Text style={styles.sectionTitle}>
            {selected ? buildStaffName(selected) : 'Seleccionar trabajador'}
          </Text>
          <Icon name="chevron-forward" size={18} color={COLORS.muted} />
        </View>
      </TouchableOpacity>

      <View style={{ paddingHorizontal: 16, marginBottom: 10 }}>
        <TextInput
          style={styles.modalInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Buscar producto..."
          placeholderTextColor={COLORS.muted}
          autoCapitalize="none"
        />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.accent} />
          <Text style={styles.loadingText}>Cargando productos...</Text>
        </View>
      ) : (
        <FlatList
          data={products}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16 }}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <ProductPickerRow
              product={item}
              quantity={quantities[item.id] || 0}
              onChange={changeQuantity}
            />
          )}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Icon name="cube-outline" size={44} color={COLORS.muted} />
              <Text style={styles.emptyText}>No se encontraron productos.</Text>
            </View>
          }
        />
      )}

      <View style={[styles.footer, { paddingBottom: bottomPadding }]}>
        <View style={styles.footerNetRow}>
          <Text style={styles.footerNetLabel}>
            {totalUnits} {totalUnits === 1 ? 'unidad' : 'unidades'}
          </Text>
          <Text style={styles.footerNetValue}>{formatMoney(total)}</Text>
        </View>

        <TouchableOpacity
          style={[styles.primaryButton, (saving || items.length === 0 || !selected) && styles.disabledButton]}
          onPress={handleConfirm}
          disabled={saving || items.length === 0 || !selected}
          activeOpacity={0.85}
        >
          {saving ? (
            <ActivityIndicator color={COLORS.surface} />
          ) : (
            <>
              <Icon name="bag-check-outline" size={19} color={COLORS.surface} />
              <Text style={styles.primaryButtonText}>Registrar entrega</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <StaffPickerModal
        visible={pickerVisible}
        staff={staff}
        selectedUid={selected?.uid || null}
        onSelect={(member) => {
          setSelected(member);
          setPickerVisible(false);
        }}
        onClose={() => setPickerVisible(false)}
      />
    </View>
  );
}
