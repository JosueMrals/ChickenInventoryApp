import React, { useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, Animated, Dimensions } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import styles from '../styles/creditLimitModalStyles';

export default function CreditLimitModal({ visible, onClose, onProceed, remaining, exceeded }) {
  const animScale = useRef(new Animated.Value(0.8)).current;
  const animOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(animScale, {
          toValue: 1,
          friction: 6,
          tension: 60,
          useNativeDriver: true,
        }),
        Animated.timing(animOpacity, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(animScale, {
          toValue: 0.8,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(animOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <View style={styles.overlay}>
      <Animated.View
        style={[
          styles.modal,
          {
            transform: [{ scale: animScale }],
            opacity: animOpacity,
          },
        ]}
      >
        <View style={styles.iconContainer}>
          <Ionicons
            name={exceeded ? 'alert-circle' : 'information-circle'}
            size={70}
            color={exceeded ? '#FF3B30' : '#007AFF'}
          />
        </View>

        <Text style={styles.title}>
          {exceeded ? 'Límite de crédito excedido' : 'Límite de crédito disponible'}
        </Text>

        <Text style={styles.message}>
          {exceeded
            ? 'El cliente ha superado su límite de crédito.\nNo puede dejar más saldo pendiente.'
            : `El cliente puede dejar pendiente hasta $${remaining?.toFixed(2) || 0}.`}
        </Text>

        <View style={styles.btnRow}>
          <TouchableOpacity
            onPress={onClose}
            style={[styles.btn, styles.btnClose]}
            activeOpacity={0.8}
          >
            <Text style={styles.btnText}>Cancelar</Text>
          </TouchableOpacity>

          {!exceeded && (
            <TouchableOpacity
              onPress={onProceed}
              style={[styles.btn, styles.btnProceed]}
              activeOpacity={0.8}
            >
              <Text style={styles.btnText}>Continuar</Text>
            </TouchableOpacity>
          )}
        </View>
      </Animated.View>
    </View>
  );
}
