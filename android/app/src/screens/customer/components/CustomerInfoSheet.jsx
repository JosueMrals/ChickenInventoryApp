// Ficha de cliente en solo lectura. Se comparte entre la lista de clientes del
// entregador y el ticket de entrega (icono de vista rápida), para que la
// información del cliente se vea igual en toda la app.
import React from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, Linking, Alert, ScrollView } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import PhotoGallery from './PhotoGallery';
import { getEffectiveCreditLimit } from '../../../utils/creditUtils';

// Nicaragua: los números locales se marcan sin prefijo; para WhatsApp sí hace falta.
const WHATSAPP_COUNTRY_CODE = '505';

const digitsOnly = (phone) => String(phone || '').replace(/\D/g, '');

const openUrl = async (url, fallbackMessage) => {
  try {
    await Linking.openURL(url);
  } catch {
    Alert.alert('No disponible', fallbackMessage);
  }
};

function InfoRow({ icon, label, value }) {
  if (!value) return null;
  return (
    <View style={s.infoRow}>
      <Icon name={icon} size={16} color="#8E8E93" style={s.infoIcon} />
      <View style={{ flex: 1 }}>
        <Text style={s.infoLabel}>{label}</Text>
        <Text style={s.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

function QuickAction({ icon, label, onPress, disabled }) {
  return (
    <TouchableOpacity
      style={[s.action, disabled && s.actionDisabled]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.85}
    >
      <Icon name={icon} size={20} color={disabled ? '#C7C7CC' : '#007AFF'} />
      <Text style={[s.actionLabel, disabled && { color: '#C7C7CC' }]}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function CustomerInfoSheet({ visible, customer, onClose }) {
  if (!customer) return null;

  const fullName = `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || customer.customerName || 'Cliente';
  const initials = `${(customer.firstName || '?')[0]}${(customer.lastName || '?')[0]}`.toUpperCase();
  const phone = digitsOnly(customer.phone);
  const address = customer.address || '';
  const discount = Number(customer.discount) || 0;
  const effectiveCredit = getEffectiveCreditLimit(customer);
  const photos = customer.photos || [];

  const call = () => openUrl(`tel:${phone}`, 'Este dispositivo no puede realizar llamadas.');
  const whatsapp = () =>
    openUrl(
      `https://wa.me/${phone.length > 8 ? phone : WHATSAPP_COUNTRY_CODE + phone}`,
      'WhatsApp no está instalado.'
    );
  const map = () =>
    openUrl(
      `geo:0,0?q=${encodeURIComponent(address)}`,
      'No hay una app de mapas disponible.'
    );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.backdrop}>
        <TouchableOpacity style={{ flex: 1 }} onPress={onClose} activeOpacity={1} />
        <View style={s.card}>
          <View style={s.grabber} />

          <View style={s.header}>
            <View style={s.avatar}>
              <Text style={s.avatarText}>{initials}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.name} numberOfLines={1}>{fullName}</Text>
              <Text style={s.type}>
                {customer.type || 'Común'}{discount > 0 ? ` · ${discount}% desc.` : ''}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={s.closeBtn}>
              <Icon name="close" size={20} color="#8E8E93" />
            </TouchableOpacity>
          </View>

          <View style={s.actions}>
            <QuickAction icon="call-outline" label="Llamar" onPress={call} disabled={!phone} />
            <QuickAction icon="logo-whatsapp" label="WhatsApp" onPress={whatsapp} disabled={!phone} />
            <QuickAction icon="navigate-outline" label="Ubicación" onPress={map} disabled={!address} />
          </View>

          <ScrollView style={s.info} showsVerticalScrollIndicator={false}>
            <InfoRow icon="call-outline" label="Teléfono" value={customer.phone || 'Sin teléfono'} />
            <InfoRow icon="location-outline" label="Dirección" value={address || 'Sin dirección'} />
            <InfoRow icon="card-outline" label="Cédula" value={customer.cedula} />
            <InfoRow
              icon="wallet-outline"
              label="Límite de crédito"
              value={
                effectiveCredit.extra > 0
                  ? `C$${effectiveCredit.total.toFixed(2)} (C$${effectiveCredit.base.toFixed(2)} + sobregiro C$${effectiveCredit.extra.toFixed(2)})`
                  : `C$${effectiveCredit.base.toFixed(2)}`
              }
            />

            {/* Fotos del local/fachada: ubicar al cliente en ruta. Solo consulta:
                sin onDelete, la galería no muestra el botón de borrar. */}
            <View style={s.photosBlock}>
              <View style={s.photosHeader}>
                <Icon name="images-outline" size={16} color="#8E8E93" />
                <Text style={s.photosTitle}>Fotos ({photos.length})</Text>
              </View>
              <PhotoGallery photos={photos} emptyText="Este cliente no tiene fotos registradas." />
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  card: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingBottom: 28,
    paddingTop: 10,
    maxHeight: '80%',
  },
  grabber: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E5E7EB',
    alignSelf: 'center',
    marginBottom: 14,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#EAF0FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 16, fontWeight: '800', color: '#007AFF' },
  name: { fontSize: 18, fontWeight: '800', color: '#1A1A1A' },
  type: { fontSize: 12, fontWeight: '600', color: '#8E8E93', marginTop: 2 },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F5F6FA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: { flexDirection: 'row', gap: 10, marginTop: 18 },
  action: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#F5F6FA',
  },
  actionDisabled: { opacity: 0.6 },
  actionLabel: { fontSize: 12, fontWeight: '700', color: '#007AFF' },
  info: { marginTop: 18 },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  infoIcon: { marginTop: 2, marginRight: 10 },
  infoLabel: { fontSize: 11, fontWeight: '600', color: '#8E8E93' },
  infoValue: { fontSize: 15, fontWeight: '600', color: '#1A1A1A', marginTop: 1 },
  photosBlock: { paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F0F0F0', marginBottom: 8 },
  photosHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  photosTitle: { fontSize: 11, fontWeight: '600', color: '#8E8E93' },
});
