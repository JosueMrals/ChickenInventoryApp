import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  Animated,
  ScrollView,
} from 'react-native';
import { styles } from '../styles/userStyles';
import RoleSelector from './RoleSelector';

const AddUserModal = ({ visible, onClose, onAddUser }) => {
  const [form, setForm] = useState({
    email: '',
    password: '',
    role: 'vendedor', // Default role
    nombre: '',
    apellido: '',
    user: '',
  });
  const animValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    animateModal(visible);
    if (visible) {
      // Reset form when modal opens
      setForm({
        email: '',
        password: '',
        role: 'vendedor',
        nombre: '',
        apellido: '',
        user: '',
      });
    }
  }, [visible]);

  const animateModal = (show) => {
    Animated.timing(animValue, {
      toValue: show ? 1 : 0,
      duration: 250,
      useNativeDriver: true,
    }).start();
  };

  const handleAdd = () => {
    onAddUser(form);
    onClose(); // Close modal after attempting to add
  };

  return (
    <Modal transparent visible={visible} animationType="none">
      <View style={styles.modalOverlay}>
        <Animated.View
          style={[
            styles.modalContainer,
            {
              transform: [
                {
                  scale: animValue.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.8, 1],
                  }),
                },
              ],
              opacity: animValue,
            },
          ]}
        >
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={styles.modalTitle}>Nuevo usuario</Text>

            <TextInput
              placeholder="Nombre"
              value={form.nombre}
              onChangeText={(t) => setForm({ ...form, nombre: t })}
              style={styles.input}
            />
            <TextInput
              placeholder="Apellido"
              value={form.apellido}
              onChangeText={(t) => setForm({ ...form, apellido: t })}
              style={styles.input}
            />
            <TextInput
              placeholder="Usuario"
              value={form.user}
              onChangeText={(t) => setForm({ ...form, user: t })}
              autoCapitalize="none"
              style={styles.input}
            />
            <TextInput
              placeholder="Correo electrónico"
              value={form.email}
              onChangeText={(t) => setForm({ ...form, email: t })}
              autoCapitalize="none"
              keyboardType="email-address"
              style={styles.input}
            />
            <TextInput
              placeholder="Contraseña (mín. 6 caracteres)"
              secureTextEntry
              value={form.password}
              onChangeText={(t) => setForm({ ...form, password: t })}
              style={styles.input}
            />
            
            <RoleSelector 
              selectedRole={form.role}
              onSelectRole={(role) => setForm({ ...form, role })}
            />

            <View style={styles.buttonContainer}>
              <TouchableOpacity onPress={handleAdd} style={styles.buttonPrimary}>
                <Text style={styles.buttonText}>Crear</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={onClose} style={styles.buttonCancel}>
                <Text style={styles.buttonText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
};

export default AddUserModal;
