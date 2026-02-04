import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  Animated,
  ScrollView,
  Alert,
} from 'react-native';
import { styles } from '../styles/userStyles';
import RoleSelector from './RoleSelector';

const EditUserModal = ({ visible, onClose, onUpdateUser, userData }) => {
  const [form, setForm] = useState({
    nombre: '',
    apellido: '',
    user: '',
    role: 'vendedor',
    password: '',
    confirmPassword: '',
  });
  const animValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (userData) {
      setForm({
        nombre: userData.nombre || '',
        apellido: userData.apellido || '',
        user: userData.user || '',
        role: userData.role || 'vendedor',
        password: '',
        confirmPassword: '',
      });
    }
  }, [userData]);

  useEffect(() => {
    animateModal(visible);
  }, [visible]);

  const animateModal = (show) => {
    Animated.timing(animValue, {
      toValue: show ? 1 : 0,
      duration: 250,
      useNativeDriver: true,
    }).start();
  };

  const handleUpdate = () => {
    const { password, confirmPassword } = form;

    if (password || confirmPassword) {
      if (password !== confirmPassword) {
        Alert.alert('Error', 'Las contraseñas no coinciden.');
        return;
      }
      if (password.length < 6) {
        Alert.alert('Error', 'La nueva contraseña debe tener al menos 6 caracteres.');
        return;
      }
    }

    onUpdateUser(userData.id, form);
    onClose();
  };

  // SOLUCIÓN: Usar la forma funcional del actualizador de estado para evitar "stale state".
  const handleTextChange = (field, value) => {
    setForm(prevForm => ({
      ...prevForm,
      [field]: value,
    }));
  };

  const handleRoleChange = (newRole) => {
    setForm(prevForm => ({
      ...prevForm,
      role: newRole,
    }));
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
            <Text style={styles.modalTitle}>Editar Usuario</Text>
            <Text style={{ ...styles.listItemText, marginBottom: 10 }}>
              Editando: {userData?.email}
            </Text>

            <TextInput
              placeholder="Nombre"
              value={form.nombre}
              onChangeText={(value) => handleTextChange('nombre', value)}
              style={styles.input}
            />
            <TextInput
              placeholder="Apellido"
              value={form.apellido}
              onChangeText={(value) => handleTextChange('apellido', value)}
              style={styles.input}
            />
            <TextInput
              placeholder="Usuario"
              value={form.user}
              onChangeText={(value) => handleTextChange('user', value)}
              autoCapitalize="none"
              style={styles.input}
            />

            <RoleSelector 
              selectedRole={form.role}
              onSelectRole={handleRoleChange}
            />
            
            <Text style={styles.passwordLabel}>Cambiar Contraseña (Opcional)</Text>
            <TextInput
              placeholder="Nueva Contraseña"
              secureTextEntry
              value={form.password}
              onChangeText={(value) => handleTextChange('password', value)}
              style={styles.input}
            />
            <TextInput
              placeholder="Confirmar Nueva Contraseña"
              secureTextEntry
              value={form.confirmPassword}
              onChangeText={(value) => handleTextChange('confirmPassword', value)}
              style={styles.input}
            />


            <View style={styles.buttonContainer}>
              <TouchableOpacity onPress={handleUpdate} style={styles.buttonPrimary}>
                <Text style={styles.buttonText}>Actualizar</Text>
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

// Add passwordLabel to styles to be more explicit
const componentStyles = {
  passwordLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    marginTop: 10,
    fontWeight: '500',
  }
};
// You can merge this with your main styles if you prefer
Object.assign(styles, componentStyles);


export default EditUserModal;
