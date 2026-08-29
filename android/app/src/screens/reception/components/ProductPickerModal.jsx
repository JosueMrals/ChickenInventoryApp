import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { subscribeProducts } from '../../productsNew1/services/productsService';
import styles, { COLORS } from '../styles/receptionStyles';

// Selector de productos para agregar una línea a la recepción.
// `excludedIds` oculta los productos ya agregados (evita duplicados en origen).
export default function ProductPickerModal({ visible, onClose, onSelect, excludedIds = [] }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!visible) return undefined;
    setLoading(true);
    const unsubscribe = subscribeProducts(
      (items) => {
        setProducts(items || []);
        setLoading(false);
      },
      { orderBy: 'name', limit: 500 }
    );
    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [visible]);

  const excluded = useMemo(() => new Set(excludedIds), [excludedIds]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return products.filter((p) => {
      if (excluded.has(p.id)) return false;
      if (!term) return true;
      const name = (p.name || '').toLowerCase();
      const barcode = (p.barcode || '').toString().toLowerCase();
      return name.includes(term) || barcode.includes(term);
    });
  }, [products, search, excluded]);

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={styles.productRow}
      activeOpacity={0.7}
      onPress={() => {
        onSelect(item);
        setSearch('');
      }}
    >
      <View style={{ flex: 1 }}>
        <Text style={styles.productName} numberOfLines={1}>{item.name || 'Producto'}</Text>
        <Text style={styles.productStock}>
          Stock actual: {Number(item.stock || 0)}
          {item.category ? `  ·  ${item.category}` : ''}
        </Text>
      </View>
      <Icon name="add-circle" size={26} color={COLORS.primary} />
    </TouchableOpacity>
  );

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Seleccionar producto</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Icon name="close" size={26} color={COLORS.ink} />
            </TouchableOpacity>
          </View>

          <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
            <TextInput
              style={styles.searchInput}
              placeholder="Buscar por nombre o código"
              placeholderTextColor={COLORS.muted}
              value={search}
              onChangeText={setSearch}
              autoCorrect={false}
            />
          </View>

          {loading ? (
            <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 30 }} />
          ) : (
            <FlatList
              data={filtered}
              keyExtractor={(item) => item.id}
              renderItem={renderItem}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={
                <View style={styles.emptyWrap}>
                  <Icon name="cube-outline" size={44} color={COLORS.faint} />
                  <Text style={styles.emptyText}>
                    {search ? 'Sin resultados para tu búsqueda.' : 'No hay más productos para agregar.'}
                  </Text>
                </View>
              }
            />
          )}
        </View>
      </View>
    </Modal>
  );
}
