import React from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

/** Menú de opciones del header, mismo patrón que CreditsFilters. */
export default function CashClosingMenu({ visible, onClose, onOpenHistory }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity style={s.menu} activeOpacity={1} onPress={() => {}}>
          <TouchableOpacity style={s.item} onPress={() => { onClose(); onOpenHistory(); }}>
            <Icon name="history" size={18} color="#6B7280" />
            <Text style={s.itemText}>Historial</Text>
            <Icon name="chevron-right" size={18} color="#C7C7CC" />
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.25)' },
  menu: {
    position: 'absolute', top: 84, right: 12, minWidth: 200,
    backgroundColor: '#fff', borderRadius: 16, paddingVertical: 8, paddingHorizontal: 6,
    shadowColor: '#0A2540', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05,
    shadowRadius: 6, elevation: 2, borderWidth: 1, borderColor: '#ECECEC',
  },
  item: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 10, paddingVertical: 10, borderRadius: 10 },
  itemText: { flex: 1, fontSize: 14, fontWeight: '600', color: '#1F2937' },
});
