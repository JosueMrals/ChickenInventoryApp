import React from 'react';
import { Modal, View, Text, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import styles, { COLORS } from '../styles/receptionStyles';

// Ventana flotante para gestionar la foto de la factura. Es presentacional: la
// lógica de permisos/subida vive en la pantalla y llega por callbacks.
export default function InvoicePhotoModal({
  visible,
  onClose,
  invoicePhoto,
  uploadingPhoto,
  onTakePhoto,
  onPickGallery,
  onRemove,
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Foto de la factura</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Icon name="close" size={26} color={COLORS.ink} />
            </TouchableOpacity>
          </View>

          <View style={{ paddingHorizontal: 16, paddingBottom: 20 }}>
            {uploadingPhoto ? (
              <View style={styles.photoPlaceholder}>
                <ActivityIndicator size="large" color={COLORS.primary} />
                <Text style={styles.lineSub}>Subiendo foto...</Text>
              </View>
            ) : invoicePhoto?.url ? (
              <Image source={{ uri: invoicePhoto.url }} style={styles.invoiceImageLarge} resizeMode="cover" />
            ) : (
              <View style={styles.photoDropzone}>
                <Icon name="receipt-outline" size={34} color={COLORS.primary} />
                <Text style={styles.lineSub}>Aún no hay foto adjunta</Text>
              </View>
            )}

            {/* Acciones */}
            <TouchableOpacity
              style={[styles.primaryBtn, { marginTop: 16 }]}
              onPress={onTakePhoto}
              disabled={uploadingPhoto}
            >
              <Text style={styles.primaryBtnText}>
                {invoicePhoto?.url ? 'Tomar otra foto' : 'Tomar foto'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.addLineBtn, { marginTop: 12, marginBottom: 0 }]}
              onPress={onPickGallery}
              disabled={uploadingPhoto}
            >
              <Icon name="images-outline" size={20} color={COLORS.primary} />
              <Text style={styles.addLineText}>Elegir de galería</Text>
            </TouchableOpacity>

            {invoicePhoto?.url && !uploadingPhoto && (
              <TouchableOpacity style={styles.ghostBtn} onPress={onRemove}>
                <Text style={[styles.ghostBtnText, { color: COLORS.red }]}>Quitar foto</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}
