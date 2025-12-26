import React from 'react';
import { View, Modal, StyleSheet, TouchableOpacity, Text } from 'react-native';
import SaleReceipt from '../../sales/components/SaleReceipt';

const SaleReceiptModal = ({ sale, visible, onClose }) => {
  if (!sale) return null;

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.centeredView}>
        <View style={styles.modalView}>
          <SaleReceipt sale={sale} />
          <TouchableOpacity
            style={styles.button}
            onPress={onClose}
          >
            <Text style={styles.textStyle}>Cerrar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  centeredView: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalView: {
    margin: 20,
    backgroundColor: "white",
    borderRadius: 20,
    padding: 25,
    alignItems: "stretch",
    shadowColor: "#000",
    shadowOffset: {
        width: 0,
        height: 2
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    width: '90%',
    maxHeight: '80%',
  },
  button: {
    backgroundColor: '#2196F3',
    borderRadius: 10,
    padding: 12,
    elevation: 2,
    marginTop: 10,
  },
  textStyle: {
    color: "white",
    fontWeight: "bold",
    textAlign: "center"
  }
});

export default SaleReceiptModal;