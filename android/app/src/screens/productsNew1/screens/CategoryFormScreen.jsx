import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import globalStyles from '../../../styles/globalStyles';
import { useProductCategories } from '../hooks/useProductCategories';
import { getUserRole } from '../../../services/auth';
import auth from '@react-native-firebase/auth';

const MAX_TIERS = 5;
const DISCOUNT_TYPES = [
  { key: 'percent', label: '%', color: '#1D4ED8' },
  { key: 'amount', label: 'C$', color: '#059669' },
];

function buildEmptyTier() {
  return {
    id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
    minQty: '',
    discountType: 'percent',
    discountValue: '',
  };
}

function getTiersFromRow(row = {}) {
  const tiers =
    Array.isArray(row.discountTiers) && row.discountTiers.length > 0
      ? row.discountTiers
      : [];
  if (tiers.length === 0) return [buildEmptyTier()];
  return tiers.map((tier) => ({
    id: `${tier.minQty}_${Math.random().toString(16).slice(2)}`,
    minQty: String(tier.minQty || ''),
    discountType: tier.discountType || 'percent',
    discountValue: tier.discountValue ? String(tier.discountValue) : '',
  }));
}

function normalizeTier(tier = {}) {
  const minQty = Math.max(0, Math.floor(Number(tier.minQty || 0)));
  const discountValue = Number(tier.discountValue || 0);
  if (!minQty || discountValue <= 0) return null;
  const discountType = ['percent', 'amount'].includes(tier.discountType)
    ? tier.discountType
    : 'percent';
  if (discountType === 'percent' && discountValue > 100) return null;
  return { minQty, discountType, discountValue, active: true };
}

export default function CategoryFormScreen({ navigation, route }) {
  const editingCategory = route?.params?.category ?? null;
  const isEditing = !!editingCategory;

  const [role, setRole] = useState(route?.params?.role || null);
  const [roleLoading, setRoleLoading] = useState(!route?.params?.role);
  const isAdmin = role === 'admin';

  const [name, setName] = useState(editingCategory?.name || '');
  const [tiers, setTiers] = useState(
    isEditing ? getTiersFromRow(editingCategory) : [buildEmptyTier()],
  );
  const [busy, setBusy] = useState(false);

  const { saveCategory } = useProductCategories({ activeOnly: false });

  // Ref para scroll automático al campo enfocado
  const scrollViewRef = useRef(null);

  // Verificar rol desde Firestore como fuente de verdad
  useEffect(() => {
    let cancelled = false;
    const currentUser = auth().currentUser;
    if (!currentUser) {
      setRole(null);
      setRoleLoading(false);
      return;
    }
    getUserRole(currentUser.uid, currentUser.email)
      .then((fetchedRole) => {
        if (!cancelled) {
          setRole(fetchedRole);
          setRoleLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setRoleLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  // ── Scroll al input enfocado ────────────────────────────────────────────────
  const scrollToInput = (event) => {
    // Damos un pequeño delay para que el teclado termine de aparecer
    if (!scrollViewRef.current) return;
    const { target } = event.nativeEvent;
    if (!target) return;
    setTimeout(() => {
      try {
        scrollViewRef.current?.scrollResponderScrollNativeHandleToKeyboard?.(
          target, 80, true,
        );
      } catch (_) {
        // fallback: scroll al final
        scrollViewRef.current?.scrollToEnd?.({ animated: true });
      }
    }, 120);
  };

  // ── Tier helpers ────────────────────────────────────────────────────────────
  const addTier = () => {
    setTiers((prev) =>
      prev.length >= MAX_TIERS ? prev : [...prev, buildEmptyTier()],
    );
    // Scroll al final para mostrar el nuevo tier
    setTimeout(() => scrollViewRef.current?.scrollToEnd?.({ animated: true }), 150);
  };

  const removeTier = (tierId) => {
    setTiers((prev) => {
      if (prev.length === 1) return [buildEmptyTier()];
      const next = prev.filter((t) => t.id !== tierId);
      return next.length > 0 ? next : [buildEmptyTier()];
    });
  };

  const patchTier = (tierId, patch) => {
    setTiers((prev) =>
      prev.map((t) => (t.id === tierId ? { ...t, ...patch } : t)),
    );
  };

  // ── Validación ──────────────────────────────────────────────────────────────
  const validateForm = () => {
    const trimmedName = String(name || '').trim();
    if (!trimmedName) {
      Alert.alert('Validación', 'Ingresa el nombre de la categoría.');
      return null;
    }

    const normalizedTiers = tiers
      .map(normalizeTier)
      .filter(Boolean)
      .sort((a, b) => a.minQty - b.minQty);

    if (normalizedTiers.length > MAX_TIERS) {
      Alert.alert('Validación', `Solo se permiten ${MAX_TIERS} niveles de descuento.`);
      return null;
    }

    const qtySet = new Set();
    for (const tier of normalizedTiers) {
      if (qtySet.has(tier.minQty)) {
        Alert.alert('Validación', 'No se permite repetir la misma cantidad mínima.');
        return null;
      }
      qtySet.add(tier.minQty);
    }

    return {
      id: editingCategory?.id ?? null,
      name: trimmedName,
      discountTiers: normalizedTiers,
    };
  };

  // ── Guardar ─────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!isAdmin) return;
    const payload = validateForm();
    if (!payload) return;
    setBusy(true);
    try {
      await saveCategory(payload);
      navigation.goBack();
    } catch {
      Alert.alert('Error', 'No se pudo guardar la categoría.');
    } finally {
      setBusy(false);
    }
  };

  // ── Render de un tier ───────────────────────────────────────────────────────
  const renderTierEditor = (tier, index) => (
    <View key={tier.id} style={styles.tierCard}>
      <View style={styles.tierHeader}>
        <View style={styles.tierBadge}>
          <Text style={styles.tierBadgeText}>Nivel {index + 1}</Text>
        </View>
        <TouchableOpacity
          style={styles.tierDeleteBtn}
          onPress={() => removeTier(tier.id)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Icon name="trash-outline" size={15} color="#DC2626" />
        </TouchableOpacity>
      </View>

      <View style={styles.tierRow}>
        {/* Cantidad mínima */}
        <View style={styles.tierQtyBox}>
          <Text style={styles.tierLabel}>Cant. mín.</Text>
          <TextInput
            style={styles.tierInput}
            value={tier.minQty}
            onChangeText={(t) => patchTier(tier.id, { minQty: t })}
            keyboardType="number-pad"
            placeholder="10"
            placeholderTextColor="#9CA3AF"
            onFocus={scrollToInput}
            returnKeyType="next"
          />
        </View>

        {/* Valor del descuento */}
        <View style={styles.tierValueBox}>
          <Text style={styles.tierLabel}>Descuento</Text>
          <TextInput
            style={styles.tierInput}
            value={tier.discountValue}
            onChangeText={(t) => patchTier(tier.id, { discountValue: t })}
            keyboardType="decimal-pad"
            placeholder="0"
            placeholderTextColor="#9CA3AF"
            onFocus={scrollToInput}
            returnKeyType="done"
          />
        </View>

        {/* Tipo de descuento */}
        <View style={styles.tierTypeBox}>
          <Text style={styles.tierLabel}>Tipo</Text>
          <View style={styles.typeToggle}>
            {DISCOUNT_TYPES.map((dt) => {
              const isActive = tier.discountType === dt.key;
              return (
                <TouchableOpacity
                  key={dt.key}
                  style={[
                    styles.typeBtn,
                    isActive && { backgroundColor: dt.color, borderColor: dt.color },
                  ]}
                  onPress={() => patchTier(tier.id, { discountType: dt.key })}>
                  <Text style={[styles.typeBtnText, isActive && styles.typeBtnTextActive]}>
                    {dt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>
    </View>
  );

  // ── Header compartido ───────────────────────────────────────────────────────
  const screenTitle = isEditing ? 'Editar Categoría' : 'Nueva Categoría';

  const HeaderBar = () => (
    <View style={globalStyles.header}>
      <TouchableOpacity onPress={() => navigation.goBack()}>
        <Icon name="chevron-back" size={26} color="#fff" />
      </TouchableOpacity>
      <Text style={globalStyles.title}>{screenTitle}</Text>
      <View style={{ width: 26 }} />
    </View>
  );

  // ── Estados de carga / acceso ───────────────────────────────────────────────
  if (roleLoading) {
    return (
      <View style={globalStyles.container}>
        <HeaderBar />
        <View style={styles.centeredBox}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      </View>
    );
  }

  if (!isAdmin) {
    return (
      <View style={globalStyles.container}>
        <HeaderBar />
        <View style={styles.centeredBox}>
          <Icon name="lock-closed-outline" size={28} color="#6B7280" />
          <Text style={styles.deniedText}>
            Solo administradores pueden gestionar categorías.
          </Text>
        </View>
      </View>
    );
  }

  // ── Vista principal ─────────────────────────────────────────────────────────
  return (
    <View style={globalStyles.container}>
      <HeaderBar />

      {/*
        KeyboardAvoidingView:
        - iOS: behavior="padding" empuja el contenido hacia arriba
        - Android: adjustResize en el Manifest maneja el resize; usamos
          behavior="height" como respaldo para navegadores/RN sin ajuste nativo
      */}
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}>

        <ScrollView
          ref={scrollViewRef}
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          // iOS RN 0.72+: el ScrollView se ajusta solo al teclado
          automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}>

          {/* ── Nombre ─────────────────────────────────────────────────────── */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Información general</Text>
            <Text style={styles.fieldLabel}>Nombre de la categoría</Text>
            <TextInput
              style={styles.nameInput}
              value={name}
              onChangeText={setName}
              placeholder="Ej. Pollo, Lácteos, Bebidas..."
              placeholderTextColor="#9CA3AF"
              autoFocus={!isEditing}
              returnKeyType="next"
              blurOnSubmit={false}
            />
          </View>

          {/* ── Niveles de descuento ────────────────────────────────────────── */}
          <View style={styles.section}>
            <View style={styles.sectionTitleRow}>
              <Text style={styles.sectionTitle}>
                Niveles de descuento{' '}
                <Text style={styles.sectionTitleCount}>
                  ({tiers.length}/{MAX_TIERS})
                </Text>
              </Text>
            </View>
            <Text style={styles.helpText}>
              Se activan cuando el carrito tiene ≥ la cantidad mínima de
              unidades de esta categoría. Todos los niveles alcanzados se
              acumulan.
            </Text>

            {tiers.map((tier, index) => renderTierEditor(tier, index))}

            <TouchableOpacity
              style={[
                styles.addTierBtn,
                tiers.length >= MAX_TIERS && styles.disabledBtn,
              ]}
              onPress={addTier}
              disabled={tiers.length >= MAX_TIERS}>
              <Icon name="add-circle-outline" size={16} color="#2563EB" />
              <Text style={styles.addTierBtnText}>
                {tiers.length >= MAX_TIERS
                  ? `Máximo ${MAX_TIERS} niveles`
                  : 'Agregar nivel'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* ── Info ───────────────────────────────────────────────────────── */}
          <View style={styles.infoCard}>
            <Icon name="information-circle-outline" size={16} color="#1D4ED8" />
            <Text style={styles.infoText}>
              Los descuentos son{' '}
              <Text style={styles.infoBold}>acumulativos</Text>: si el cliente
              alcanza múltiples niveles, todos se aplican simultáneamente. La
              prioridad es el que resulte en el precio más bajo para el cliente
              (vs. descuento mayorista).
            </Text>
          </View>

          {/* ── Botones de acción ───────────────────────────────────────────── */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => navigation.goBack()}
              disabled={busy}>
              <Text style={styles.cancelBtnText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveBtn, busy && styles.disabledBtn]}
              onPress={handleSave}
              disabled={busy}>
              {busy ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Icon
                    name={isEditing ? 'checkmark-done-outline' : 'save-outline'}
                    size={16}
                    color="#fff"
                  />
                  <Text style={styles.saveBtnText}>
                    {isEditing ? 'Actualizar' : 'Guardar'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scrollContent: {
    padding: 16,
    // Padding generoso al final: asegura que los botones
    // sean siempre visibles por encima del teclado
    paddingBottom: 60,
  },
  centeredBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 24,
  },
  deniedText: {
    color: '#374151',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 6,
  },
  // ── Sección ──────────────────────────────────────────────────────────────────
  section: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 2,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 10,
  },
  sectionTitleCount: {
    color: '#9CA3AF',
    fontWeight: '600',
    fontSize: 13,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#374151',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  nameInput: {
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 13,
    paddingVertical: 12,
    fontSize: 15,
    color: '#111827',
  },
  helpText: {
    fontSize: 11,
    color: '#6B7280',
    lineHeight: 16,
    marginBottom: 12,
  },
  // ── Tier editor ──────────────────────────────────────────────────────────────
  tierCard: {
    borderWidth: 1,
    borderColor: '#DBEAFE',
    borderRadius: 12,
    padding: 10,
    marginBottom: 10,
    backgroundColor: '#EFF6FF',
  },
  tierHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  tierBadge: {
    backgroundColor: '#1D4ED8',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  tierBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  tierDeleteBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEE2E2',
  },
  tierRow: { flexDirection: 'row', gap: 8 },
  tierQtyBox: { flex: 1 },
  tierValueBox: { flex: 1 },
  tierTypeBox: { flex: 0.9 },
  tierLabel: { fontSize: 10, fontWeight: '700', color: '#374151', marginBottom: 4 },
  tierInput: {
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 8,
    paddingVertical: 10,
    fontSize: 14,
    color: '#111827',
    textAlign: 'center',
  },
  typeToggle: { flexDirection: 'row', gap: 4 },
  typeBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeBtnText: { fontSize: 13, fontWeight: '700', color: '#374151' },
  typeBtnTextActive: { color: '#fff' },
  addTierBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 10,
    paddingVertical: 11,
    backgroundColor: '#EFF6FF',
    marginTop: 2,
  },
  addTierBtnText: { color: '#2563EB', fontWeight: '700', fontSize: 13 },
  // ── Info card ────────────────────────────────────────────────────────────────
  infoCard: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    padding: 12,
    marginBottom: 20,
    alignItems: 'flex-start',
  },
  infoText: { flex: 1, fontSize: 11, color: '#1E3A8A', lineHeight: 16 },
  infoBold: { fontWeight: '700' },
  // ── Actions ──────────────────────────────────────────────────────────────────
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  cancelBtnText: { color: '#374151', fontWeight: '700', fontSize: 14 },
  saveBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 15,
    borderRadius: 12,
    backgroundColor: '#007AFF',
  },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  disabledBtn: { opacity: 0.55 },
});

