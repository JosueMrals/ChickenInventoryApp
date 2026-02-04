import React from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import useCustomerSearch from '../hooks/useCustomerSearch';
import styles from '../styles/saleModalStyles';

export default function CustomerSearch({ selected, setSelected }) {
  const { filtered, query, setQuery } = useCustomerSearch();

  // Si ya hay cliente seleccionado → mostrar tarjeta con botón de eliminar
  if (selected) {
    return (
      <View style={styles.selectedCustomerCard}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View>
            <Text style={styles.selectedCustomerName}>
              {selected.firstName} {selected.lastName}
            </Text>
            {selected.cedula && (
              <Text style={styles.selectedCustomerId}>
                Cédula: {selected.cedula}
              </Text>
            )}
          </View>
          <TouchableOpacity onPress={() => setSelected(null)}>
            <Ionicons name="close-circle" size={24} color="#FF3B30" />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Si no hay cliente seleccionado → mostrar buscador
  return (
    <View>
      <TextInput
        placeholder="Buscar cliente..."
        value={query}
        onChangeText={setQuery}
        style={styles.input}
      />

      {filtered.length > 0 && (
        <View style={styles.searchResultContainer}>
          <ScrollView keyboardShouldPersistTaps="handled">
            {filtered.map((c) => (
              <TouchableOpacity
                key={c.id}
                onPress={() => {
                  setSelected(c);
                  setQuery('');
                }}
                style={styles.customerItem}
              >
                <Text style={styles.customerName}>
                  {c.firstName} {c.lastName}
                </Text>
                {c.cedula && (
                  <Text style={styles.customerInfo}>Cédula: {c.cedula}</Text>
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}
