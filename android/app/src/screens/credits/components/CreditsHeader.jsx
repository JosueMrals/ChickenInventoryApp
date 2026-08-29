import React from 'react';
import { Text, View, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import globalStyles from '../../../styles/globalStyles';

// Los totales pueden venir en null si el agregado del servidor falló: se muestra
// "—" en vez de un C$0.00 que se leería como "no hay saldo pendiente".
const money = (value) =>
  Number.isFinite(value) ? `C$${value.toFixed(2)}` : '—';

export default function CreditsHeader({ totals, onBack, onOpenMenu, filtersActive = false }) {
  const total = Number.isFinite(totals.paid) && Number.isFinite(totals.pending)
    ? totals.paid + totals.pending
    : null;

  return (
    <View>
      <View style={globalStyles.header}>
        {onBack ? (
          <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Icon name="arrow-left" size={26} color="#fff" />
          </TouchableOpacity>
        ) : <View style={{ width: 26 }} />}

        <Text style={globalStyles.title}>Créditos</Text>

        {onOpenMenu ? (
          <TouchableOpacity onPress={onOpenMenu} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Icon name="dots-vertical" size={26} color="#fff" />
            {/* Punto rojo: sin él no hay forma de saber que la lista está acotada
                por un filtro que vive escondido en el menú. */}
            {filtersActive && (
              <View style={{
                position: 'absolute', top: 0, right: 0, width: 9, height: 9,
                borderRadius: 5, backgroundColor: '#FF3B30', borderWidth: 1.5, borderColor: '#007AFF',
              }} />
            )}
          </TouchableOpacity>
        ) : <View style={{ width: 26 }} />}
      </View>

      <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: '#F2F3F7' }}>
        {[
          { label: 'Total',     value: total,          bg: '#E8F0FE', color: '#1A56DB' },
          { label: 'Cobrado',   value: totals.paid,    bg: '#DCFCE7', color: '#166534' },
          { label: 'Pendiente', value: totals.pending, bg: '#FEE2E2', color: '#991B1B' },
        ].map(({ label, value, bg, color }) => (
          <View key={label} style={{ flex: 1, backgroundColor: bg, borderRadius: 10, paddingVertical: 7, alignItems: 'center' }}>
            <Text style={{ fontSize: 9, fontWeight: '700', color, textTransform: 'uppercase', letterSpacing: 0.3, opacity: 0.7 }}>{label}</Text>
            <Text style={{ fontSize: 13, fontWeight: '800', color, marginTop: 1 }}>{money(value)}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}
