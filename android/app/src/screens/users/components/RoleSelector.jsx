import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { styles as userStyles } from '../styles/userStyles';

const ROLES = ['admin', 'vendedor', 'entregador', 'bodeguero'];

const RoleSelector = ({ selectedRole, onSelectRole }) => {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>Rol:</Text>
      <View style={styles.rolesContainer}>
        {ROLES.map((role) => (
          <TouchableOpacity
            key={role}
            style={[
              styles.chip,
              selectedRole === role && styles.chipSelected,
            ]}
            onPress={() => onSelectRole(role)}
          >
            <Text
              style={[
                styles.chipText,
                selectedRole === role && styles.chipTextSelected,
              ]}
            >
              {/* Capitalize first letter */}
              {role.charAt(0).toUpperCase() + role.slice(1)} 
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 12,
  },
  label: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    fontWeight: '500',
  },
  rolesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#F0F0F0',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  chipSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  chipText: {
    color: '#333',
    fontWeight: '600',
  },
  chipTextSelected: {
    color: '#fff',
  },
});

export default RoleSelector;
