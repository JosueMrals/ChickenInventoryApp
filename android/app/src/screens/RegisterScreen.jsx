import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Modal,
  Alert,
  ActivityIndicator,
  Animated,
  SafeAreaView,
} from 'react-native';
import { firestore, auth } from '../services/firebaseConfig';

export default function RegisterScreen({ route, navigation }) {
  const { role: currentRole, user: currentUser } = route.params || {};
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [form, setForm] = useState({ email: '', password: '', role: 'user' });
  const animValue = useRef(new Animated.Value(0)).current;

  // 🔹 Escucha la colección de usuarios
  useEffect(() => {

    if (currentRole !== 'admin') {
      Alert.alert('Acceso denegado', 'Solo los administradores pueden ver esta sección.');
      navigation.goBack();
      return;
    }

    const unsubscribe = firestore()
      .collection('users')
      .orderBy('email', 'asc')
      .onSnapshot(
        (snapshot) => {
          if (!snapshot || !snapshot.docs) {
            console.log('⚠️ Snapshot nulo en Firestore');
            setUsers([]);
            setLoading(false);
            return;
          }
          const data = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));
          setUsers(data);
          setLoading(false);
        },
        (error) => {
          console.log('🔥 Error Firestore snapshot:', error);
          setLoading(false);
        }
      );

    return () => unsubscribe();
  }, []);

  // 🔹 Animación modal
  const animateModal = (show) => {
    Animated.timing(animValue, {
      toValue: show ? 1 : 0,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      if (!show) setModalVisible(false);
    });
  };

  const openModal = () => {
    setModalVisible(true);
    setForm({ email: '', password: '', role: 'user' });
    animateModal(true);
  };

  const closeModal = () => {
    animateModal(false);
  };

  // 🔹 Crear usuario con UID y verificación
  const handleAddUser = async () => {
    if (!form.email.trim() || !form.password.trim()) {
      Alert.alert('Campos requeridos', 'Correo y contraseña son obligatorios.');
      return;
    }

    try {
      const admin = auth().currentUser;
      if (!admin) {
        Alert.alert('Error', 'No hay un administrador autenticado.');
        return;
      }

      const adminToken = await admin.getIdToken(true);
      console.log('🔐 Admin token generado correctamente.');

      // Crear usuario temporalmente
      const newUserCredential = await auth().createUserWithEmailAndPassword(
        form.email.trim(),
        form.password.trim()
      );

      const newUser = newUserCredential.user;
      console.log('✅ Usuario creado:', newUser.uid);

      // Enviar correo de verificación
      await newUser.sendEmailVerification();

      // Crear documento en Firestore con UID
      await firestore().collection('users').doc(newUser.uid).set({
        uid: newUser.uid,
        email: form.email.trim(),
        role: form.role.trim().toLowerCase(),
        verified: false,
        createdBy: admin.uid,
        createdAt: new Date(),
      });

      Alert.alert(
        'Usuario creado correctamente',
        `📩 Se envió un correo de verificación a ${form.email}.
        El usuario se registrará como verificado cuando confirme su correo.`
      );

      // Restaurar sesión del admin
      await auth().signOut();
      await auth().signInWithCustomToken(adminToken);
      console.log('🔄 Sesión del admin restaurada.');

      closeModal();
    } catch (error) {
      console.log('🔥 Error creando usuario:', error);
      Alert.alert('Error', error.message);
    }
  };

  // 🔹 Eliminar usuario
  const handleDeleteUser = async (uid, email) => {
    Alert.alert('Eliminar usuario', `¿Eliminar a ${email}?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          try {
            await firestore().collection('users').doc(uid).delete();
            Alert.alert('Usuario eliminado', `${email} eliminado con éxito.`);
          } catch (e) {
            Alert.alert('Error', e.message);
          }
        },
      },
    ]);
  };

  const renderItem = ({ item }) => (
    <Animated.View
      style={{
        backgroundColor: '#fff',
        marginHorizontal: 10,
        marginVertical: 6,
        borderRadius: 14,
        padding: 16,
        elevation: 2,
      }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <View>
          <Text style={{ fontSize: 16, fontWeight: '600' }}>{item.email}</Text>
          <Text style={{ color: '#777', fontSize: 14 }}>
            Rol: {item.role.toUpperCase()}
          </Text>
          <Text
            style={{
              color: item.verified ? '#007AFF' : '#FF9500',
              fontSize: 13,
              fontWeight: '600',
            }}
          >
            {item.verified ? 'Verificado' : 'Pendiente de verificación'}
          </Text>
        </View>

        {item.id !== currentUser?.uid && (
          <TouchableOpacity onPress={() => handleDeleteUser(item.id, item.email)}>
            <Text style={{ color: '#FF3B30', fontWeight: '700' }}>Eliminar</Text>
          </TouchableOpacity>
        )}
      </View>
    </Animated.View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F5F6FA' }}>
      {/* Header */}
      <View
        style={{
          padding: 16,
          backgroundColor: '#007AFF',
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottomLeftRadius: 14,
          borderBottomRightRadius: 14,
        }}
      >
        <Text style={{ color: '#fff', fontSize: 22, fontWeight: '700', paddingTop: 10 }}>
          Administración de Usuarios
        </Text>
        <TouchableOpacity onPress={() => navigation.openDrawer()}>
          <Text style={{ color: '#fff', fontSize: 18, paddingTop:10 }}>☰</Text>
        </TouchableOpacity>
      </View>

      {/* Lista */}
      {loading ? (
        <View style={{flex:1,justifyContent:'center',alignItems:'center'}}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      ) : (
        <FlatList
          data={users}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingVertical: 10 }}
        />
      )}

      {/* Botón agregar */}
      <TouchableOpacity
        onPress={openModal}
        style={{
          position: 'absolute',
          right: 20,
          bottom: 30,
          backgroundColor: '#007AFF',
          width: 60,
          height: 60,
          borderRadius: 30,
          justifyContent: 'center',
          alignItems: 'center',
          elevation: 5,
        }}
      >
        <Text style={{ color: '#fff', fontSize: 28, fontWeight: '700' }}>+</Text>
      </TouchableOpacity>

      {/* Modal agregar usuario */}
      <Modal transparent visible={modalVisible} animationType="none">
        <View
          style={{
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: 'rgba(0,0,0,0.5)',
            padding: 20,
          }}
        >
          <Animated.View
            style={{
              backgroundColor: '#fff',
              borderRadius: 12,
              padding: 20,
              width: '100%',
              transform: [
                {
                  scale: animValue.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.8, 1],
                  }),
                },
              ],
              opacity: animValue,
            }}
          >
            <Text style={{ fontSize: 20, fontWeight: '700', marginBottom: 10 }}>
              Nuevo usuario
            </Text>

            <TextInput
              placeholder="Correo electrónico"
              value={form.email}
              onChangeText={(t) => setForm({ ...form, email: t })}
              autoCapitalize="none"
              style={inputStyle}
            />
            <TextInput
              placeholder="Contraseña"
              secureTextEntry
              value={form.password}
              onChangeText={(t) => setForm({ ...form, password: t })}
              style={inputStyle}
            />
            <TextInput
              placeholder="Rol (admin o user)"
              value={form.role}
              onChangeText={(t) => setForm({ ...form, role: t })}
              style={inputStyle}
            />

            <View style={{ flexDirection: 'row', marginTop: 10 }}>
              <TouchableOpacity onPress={handleAddUser} style={btnPrimary}>
                <Text style={{ color: '#fff', fontWeight: '600' }}>Crear</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={closeModal} style={btnCancel}>
                <Text style={{ color: '#fff', fontWeight: '600' }}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const inputStyle = {
  backgroundColor: '#F9FAFB',
  borderWidth: 1,
  borderColor: '#ddd',
  borderRadius: 8,
  padding: 12,
  marginBottom: 8,
};

const btnPrimary = {
  flex: 1,
  backgroundColor: '#007AFF',
  padding: 12,
  borderRadius: 8,
  alignItems: 'center',
  marginRight: 5,
};

const btnCancel = {
  flex: 1,
  backgroundColor: '#FF3B30',
  padding: 12,
  borderRadius: 8,
  alignItems: 'center',
  marginLeft: 5,
};
