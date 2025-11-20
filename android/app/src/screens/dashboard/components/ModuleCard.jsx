import React from 'react';
import { TouchableOpacity, Text, Animated } from 'react-native';
import Ionicons from "react-native-vector-icons/Ionicons";
import styles from '../styles/dashboardStyles';
import { useNavigation } from '@react-navigation/native';

export default function ModuleCard({ item, anim, user, role }) {
  const navigation = useNavigation();
  return (
    <TouchableOpacity
      onPress={() => navigation.navigate(item.screen, { user, role })}
      activeOpacity={0.9}
      style={[
        styles.moduleCard,
        {
          backgroundColor: item.color,
          transform: [
            {
              scale: anim.interpolate({
                inputRange: [0, 1],
                outputRange: [0.9, 1],
              }),
            },
          ],
          opacity: anim,
        },
      ]}
    >
      <Ionicons name={item.icon} size={40} color="#fff" />
      <Text style={styles.moduleLabel}>{item.label}</Text>
    </TouchableOpacity>
  );
}
