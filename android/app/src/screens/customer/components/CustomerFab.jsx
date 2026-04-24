import React from 'react';
import { TouchableOpacity, Text } from 'react-native';
import styles from '../styles/styles';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

export default function CustomerFab({ onPress, visible = true, bottom }) {
  if (!visible) return null;
  return (
    <TouchableOpacity onPress={onPress} style={[styles.fab, bottom != null && { bottom }]}>
      <Icon name="plus" size={26} color="#fff" />
    </TouchableOpacity>
  );
}
