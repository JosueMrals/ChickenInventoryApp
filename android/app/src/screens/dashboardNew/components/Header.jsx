// components/Header.jsx
import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import styles from "../styles/dashboardStyles";
import {useNavigation} from '@react-navigation/native';

export default function Header({ onCustomerPress }) {

    const navigation = useNavigation();
  const userRole = 'customer';

  return (
    <View style={styles.header}>
      <Text style={styles.logo}>YIMI-Copia</Text>

      <TouchableOpacity style={styles.headerRight} onPress={() => navigation.navigate('Customer', { role: userRole })}>
          <Text style={styles.headerRightText}>Cliente</Text>
        <Ionicons name="person-circle-outline" size={28} color="#333" />
      </TouchableOpacity>
    </View>
  );
}
