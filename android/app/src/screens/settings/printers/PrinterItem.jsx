import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import styles from "./styles/printerStyles";

export default function PrinterItem({ device, onConnect }) {
  return (
    <TouchableOpacity style={styles.printerItem} onPress={() => onConnect(device)}>
      <Text style={styles.printerName}>{device.name}</Text>
      <Text style={styles.printerId}>{device.id}</Text>
    </TouchableOpacity>
  );
}
