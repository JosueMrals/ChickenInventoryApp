import React from 'react';
import {
  View, Modal, ScrollView, StyleSheet, TouchableOpacity,
  TouchableWithoutFeedback, Text,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import SaleReceipt from '../../sales/components/SaleReceipt';
import { useReceiptContext } from '../hooks/useReceiptContext';

const KIND_LABEL = { sale: 'Venta rápida', presale: 'Pre-venta' };

/**
 * Ticket de entrega de una venta del reporte.
 *
 * El contenido va dentro de un ScrollView: `SaleReceipt` es una vista de altura
 * libre y el modal está acotado al 85% de la pantalla, así que un ticket con
 * varios productos se cortaba y no había forma de llegar al TOTAL ni al pie.
 */
const SaleReceiptModal = ({ sale, visible, onClose }) => {
  // Solo se resuelve mientras el modal está abierto.
  const { usersById, ticketSettings } = useReceiptContext(visible && !!sale);

  if (!sale) return null;

  const number = sale.receiptNumber || sale.saleNumber || sale.preSaleNumber || 'N/A';
  const kind = KIND_LABEL[sale.__kind] || 'Documento';

  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
      {/* Tocar fuera cierra: antes solo se podía con el botón del pie, que en un
          ticket largo quedaba fuera de la pantalla. */}
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop} />
      </TouchableWithoutFeedback>

      <View style={styles.sheetWrapper} pointerEvents="box-none">
        <View style={styles.sheet}>
          {/* Cabecera fija: identifica el documento sin tener que desplazarse */}
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerTitle}>Ticket de entrega</Text>
              <Text style={styles.headerMeta}>{kind} · #{number}</Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={styles.closeIcon}
            >
              <Icon name="close" size={22} color="#8E8E93" />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <SaleReceipt
              sale={sale}
              usersById={usersById}
              ticketSettings={ticketSettings}
            />
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity style={styles.closeButton} onPress={onClose} activeOpacity={0.85}>
              <Text style={styles.closeButtonText}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

// Tokens de ../DESIGN.md: Field Blue como acento, la única receta de sombra y
// radios de 16 para tarjetas. Antes el botón usaba un azul Material (#2196F3)
// y una sombra negra ajena al sistema.
const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheetWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  sheet: {
    width: '100%',
    maxHeight: '85%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#0A2540',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  headerTitle: { fontSize: 15, fontWeight: '700', color: '#1A1A1A' },
  headerMeta: { fontSize: 12, fontWeight: '500', color: '#8E8E93', marginTop: 2 },
  closeIcon: { padding: 4 },

  // flexShrink permite que el área del ticket se encoja dentro del alto máximo
  // de la hoja (y por tanto desplace); un ticket corto deja la hoja compacta.
  scroll: { flexShrink: 1 },
  scrollContent: { paddingHorizontal: 8, paddingBottom: 8 },

  footer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#EEEEEE',
  },
  closeButton: {
    backgroundColor: '#007AFF',
    borderRadius: 30,
    paddingVertical: 13,
    alignItems: 'center',
  },
  closeButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});

export default SaleReceiptModal;
