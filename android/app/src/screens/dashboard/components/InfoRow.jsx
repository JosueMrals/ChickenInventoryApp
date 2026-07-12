import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import styles from '../styles/InfoSectionStyles';

export default function InfoRow({ icon, color = '#007AFF', label, value, onPress, wrapValue = false }) {
  const Container = onPress ? TouchableOpacity : View;

  return (
    <Container
      style={styles.row}
      onPress={onPress}
      activeOpacity={onPress ? 0.6 : 1}
    >
      <View style={[styles.rowIconContainer, { backgroundColor: color + '15' }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <Text style={wrapValue ? styles.rowLabelFixed : styles.rowLabel} numberOfLines={1}>{label}</Text>
      {value != null && (
        <Text
          style={wrapValue ? styles.rowValueWrap : styles.rowValue}
          numberOfLines={wrapValue ? 2 : 1}
        >
          {value}
        </Text>
      )}
      {onPress && <Ionicons name="chevron-forward" size={18} color="#C7C7CC" />}
    </Container>
  );
}
