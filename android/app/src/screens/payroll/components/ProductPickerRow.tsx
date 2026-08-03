import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { COLORS, formatMoney } from '../styles/payrollStyles';
import { CatalogProduct } from '../hooks/useStaffPurchaseCart';

interface Props {
  product: CatalogProduct;
  quantity: number;
  onChange: (product: CatalogProduct, delta: number) => void;
}

/** Fila del catálogo con el contador +/- de la entrega. */
const ProductPickerRow = ({ product, quantity, onChange }: Props) => {
  const outOfStock = product.stock <= 0;
  const atMax = quantity >= product.stock;

  return (
    <View style={s.row}>
      <View style={{ flex: 1 }}>
        <Text style={s.name} numberOfLines={2}>{product.name}</Text>
        <Text style={[s.meta, outOfStock && { color: COLORS.danger }]}>
          {outOfStock ? 'Sin existencias' : `${product.stock} disp. · ${formatMoney(product.unitPrice)}`}
        </Text>
      </View>

      <View style={s.stepper}>
        <TouchableOpacity
          style={[s.stepBtn, quantity === 0 && s.stepBtnDisabled]}
          onPress={() => onChange(product, -1)}
          disabled={quantity === 0}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        >
          <Icon name="remove" size={16} color={quantity === 0 ? COLORS.muted : COLORS.accent} />
        </TouchableOpacity>

        <Text style={[s.qty, quantity > 0 && { color: COLORS.accent }]}>{quantity}</Text>

        <TouchableOpacity
          style={[s.stepBtn, (outOfStock || atMax) && s.stepBtnDisabled]}
          onPress={() => onChange(product, 1)}
          disabled={outOfStock || atMax}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        >
          <Icon name="add" size={16} color={outOfStock || atMax ? COLORS.muted : COLORS.accent} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const s = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: COLORS.surface, borderRadius: 12,
    paddingVertical: 10, paddingHorizontal: 12, marginBottom: 8,
  },
  name: { fontSize: 14, fontWeight: '600', color: COLORS.ink },
  meta: { fontSize: 11, fontWeight: '500', color: COLORS.muted, marginTop: 3 },

  stepper: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  stepBtn: {
    width: 30, height: 30, borderRadius: 8,
    borderWidth: 1.5, borderColor: COLORS.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  stepBtnDisabled: { borderColor: COLORS.border },
  qty: { minWidth: 26, textAlign: 'center', fontSize: 15, fontWeight: '800', color: COLORS.muted },
});

export default React.memo(ProductPickerRow);
