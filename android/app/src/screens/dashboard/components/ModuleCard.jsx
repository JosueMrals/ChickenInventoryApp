import React from 'react';
import { TouchableOpacity, Text, View, Animated } from 'react-native';
import Ionicons from "react-native-vector-icons/Ionicons";
import styles from '../styles/ModuleCardStyles';
import { useNavigation } from '@react-navigation/native';

const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);

export default function ModuleCard({ item, anim, user, role }) {
  const navigation = useNavigation();

  return (
    <AnimatedTouchableOpacity
      onPress={() => navigation.navigate(item.screen, { user, role })}
      activeOpacity={0.7}
      style={[
        styles.moduleCard,
        {
          transform: [
            {
              scale: anim.interpolate({
                inputRange: [0, 1],
                outputRange: [0.95, 1],
              }),
            },
          ],
          opacity: anim,
        },
      ]}
    >
      <View style={[styles.moduleIconContainer, { backgroundColor: item.color + '15' }]}>
        <Ionicons name={item.icon} size={28} color={item.color} />
      </View>
      <Text style={styles.moduleLabel}>{item.label}</Text>
    </AnimatedTouchableOpacity>
  );
}
