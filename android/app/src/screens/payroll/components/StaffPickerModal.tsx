import React, { useMemo, useState } from 'react';
import { View, Text, Modal, FlatList, TextInput, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import styles, { COLORS } from '../styles/payrollStyles';
import { ROLE_LABELS, StaffMember } from '../types';
import { buildStaffName } from '../services/payrollService';

interface Props {
  visible: boolean;
  staff: StaffMember[];
  selectedUid?: string | null;
  onSelect: (member: StaffMember) => void;
  onClose: () => void;
}

/** Selector del trabajador que recibe los productos. */
const StaffPickerModal = ({ visible, staff, selectedUid, onSelect, onClose }: Props) => {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return staff;
    return staff.filter((m) => buildStaffName(m).toLowerCase().includes(term));
  }, [staff, search]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={[styles.modalCard, { maxHeight: '80%' }]}>
          <Text style={styles.modalTitle}>Seleccionar trabajador</Text>
          <Text style={styles.modalSubtitle}>
            Los productos se cargarán a su cuenta hasta el día de pago.
          </Text>

          <TextInput
            style={styles.modalInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Buscar por nombre..."
            placeholderTextColor={COLORS.muted}
            autoCapitalize="none"
          />

          <FlatList
            data={filtered}
            keyExtractor={(item) => item.uid}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => {
              const selected = item.uid === selectedUid;
              return (
                <TouchableOpacity
                  style={[styles.lineRow, selected && { backgroundColor: COLORS.accentSoft, borderRadius: 10 }]}
                  onPress={() => onSelect(item)}
                  activeOpacity={0.75}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.lineTitle}>{buildStaffName(item)}</Text>
                    <Text style={styles.lineMeta}>{ROLE_LABELS[item.role] || item.role}</Text>
                  </View>
                  {selected && <Icon name="checkmark-circle" size={20} color={COLORS.accent} />}
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={
              <Text style={styles.sectionEmpty}>No se encontraron trabajadores.</Text>
            }
          />

          <TouchableOpacity
            style={[styles.secondaryButton, { marginTop: 14 }]}
            onPress={onClose}
            activeOpacity={0.8}
          >
            <Text style={styles.secondaryButtonText}>Cerrar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

export default StaffPickerModal;
