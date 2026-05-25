import React, { useCallback, useContext, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import firestore, { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import { NavigationProp, RouteProp } from '@react-navigation/native';

import SaleReceipt from '../sales/components/SaleReceipt';
import { PreSaleContext } from './context/preSaleContext';
import { printPreSaleDoneReceipt } from '../settings/printers/services/printerService';
import styles from './styles/preSaleDoneScreenStyles';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SaleItem {
  productName?: string;
  name?: string;
  quantity: number;
  unitPrice: number;
  discount?: number;
  total: number;
  pricingSource?: string;
  autoDiscountTotal?: number;
  categoryDiscountTiersCount?: number;
  isBonus?: boolean;
}

export interface BonusRecord {
  id: string;
  productName?: string;
  name?: string;
  quantity: number;
  triggerProductName?: string;
  relatedSaleId?: string;
  type?: string;
}

export interface Sale {
  id: string;
  createdBy?: string;
  cashierName?: string;
  operatorName?: string;
  userEmail?: string;
  cashierEmail?: string;
  originalCreatedBy?: string;
  preSaleCreatedBy?: string;
  createdAt?: FirebaseFirestoreTypes.Timestamp | null;
  items?: SaleItem[];
  bonuses?: BonusRecord[];
  customer?: Record<string, string> | null;
  customerName?: string;
  paymentMethod?: string;
  subtotal?: number;
  totalDiscount?: number;
  categoryDiscountTotal?: number;
  total?: number;
  amountPaid?: number;
  change?: number;
  receiptNumber?: string;
  saleNumber?: string;
}

type PreSaleDoneRouteParams = {
  PreSaleDone: { saleId: string };
};

interface Props {
  navigation: NavigationProp<PreSaleDoneRouteParams, 'PreSaleDone'>;
  route: RouteProp<PreSaleDoneRouteParams, 'PreSaleDone'>;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function PreSaleDoneScreen({ navigation, route }: Props): React.JSX.Element {
  const { loadPreSales } = useContext(PreSaleContext);
  const { saleId } = route.params;

  const [sale, setSale] = useState<Sale | null>(null);
  const [bonuses, setBonuses] = useState<BonusRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [printing, setPrinting] = useState<boolean>(false);

  // Usuario autenticado actual (como respaldo si sale.createdBy no está)
  const currentUser = auth().currentUser;

  // ── Suscripción Firestore ──────────────────────────────────────────────────
  useEffect(() => {
    if (!saleId) return;

    const unsubSale = firestore()
      .collection('sales')
      .doc(saleId)
      .onSnapshot((snap) => {
        if (snap.exists) {
          const data = snap.data() as Omit<Sale, 'id'>;
          setSale({
            id: snap.id,
            ...data,
            createdBy: data?.createdBy ?? currentUser?.email ?? undefined,
          });
        }
        setLoading(false);
      });

    const unsubBonuses = firestore()
      .collection('inventoryMovements')
      .where('relatedSaleId', '==', saleId)
      .where('type', '==', 'BONUS_OUT')
      .onSnapshot((querySnap) => {
        setBonuses(
          querySnap.docs.map((doc) => ({ id: doc.id, ...(doc.data() as Omit<BonusRecord, 'id'>) })),
        );
      });

    return () => {
      unsubSale();
      unsubBonuses();
    };
  }, [saleId]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handlePrint = useCallback(async (): Promise<void> => {
    if (printing || !sale) return;
    try {
      setPrinting(true);
      await printPreSaleDoneReceipt(sale, bonuses);
    } catch (e: any) {
      console.error('[PRESALE] Error al imprimir:', e);
      Alert.alert('Error de Impresión', e?.message ?? 'Verifica la conexión con la impresora.');
    } finally {
      setPrinting(false);
    }
  }, [printing, sale, bonuses]);

  const handleGoBack = useCallback((): void => {
    loadPreSales();
    navigation.reset({ index: 0, routes: [{ name: 'PreSalesList' as any }] });
  }, [loadPreSales, navigation]);

  // ── Estado de carga ────────────────────────────────────────────────────────

  if (loading || !sale) {
    return (
      <SafeAreaView style={styles.loadingScreen}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Cargando recibo…</Text>
      </SafeAreaView>
    );
  }

  // ── Vista principal ────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.screen}>
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Icon name="checkmark-done-circle" size={22} color="#22C55E" />
          <Text style={styles.headerTitle}>Pre-Venta Pagada</Text>
        </View>
        <TouchableOpacity onPress={handleGoBack} style={styles.closeBtn}>
          <Icon name="close" size={20} color="#6B7280" />
        </TouchableOpacity>
      </View>

      {/* ── Recibo digital (solo visualización) ──────────────────────────── */}
      <ScrollView style={styles.scrollArea} contentContainerStyle={styles.scrollContent}>
        <SaleReceipt sale={sale} bonuses={bonuses} />
      </ScrollView>

      {/* ── Acciones ─────────────────────────────────────────────────────── */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.printBtn, printing && styles.btnDisabled]}
          onPress={handlePrint}
          disabled={printing}
          activeOpacity={0.85}
        >
          {printing ? (
            <>
              <ActivityIndicator size="small" color="#fff" />
              <Text style={styles.printBtnText}>Imprimiendo…</Text>
            </>
          ) : (
            <>
              <Icon name="print-outline" size={20} color="#fff" />
              <Text style={styles.printBtnText}>Imprimir</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.backBtn} onPress={handleGoBack} activeOpacity={0.85}>
          <Icon name="arrow-back-outline" size={18} color="#374151" />
          <Text style={styles.backBtnText}>Volver a Pre-Ventas</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
