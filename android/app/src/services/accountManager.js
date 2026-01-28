import AsyncStorage from '@react-native-async-storage/async-storage';

const ACCOUNTS_KEY = 'saved_accounts_v1';

/**
 * Gestiona el almacenamiento de cuentas localmente.
 * NOTA DE SEGURIDAD: En una aplicación de producción real, las credenciales (password)
 * deben almacenarse usando 'react-native-keychain' o 'react-native-encrypted-storage'.
 * AsyncStorage no está encriptado.
 */

export const getSavedAccounts = async () => {
  try {
    const jsonValue = await AsyncStorage.getItem(ACCOUNTS_KEY);
    return jsonValue != null ? JSON.parse(jsonValue) : [];
  } catch (e) {
    console.error('Error leyendo cuentas guardadas:', e);
    return [];
  }
};

export const saveAccount = async (user, password, role) => {
  try {
    const currentAccounts = await getSavedAccounts();

    // Verificar si ya existe (actualizar datos)
    const index = currentAccounts.findIndex(acc => acc.uid === user.uid);

    const newAccount = {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName || user.email.split('@')[0],
      role: role || 'user',
      password: password, // TODO: Encriptar esto o usar SecureStorage
      lastLogin: new Date().toISOString(),
      photoURL: user.photoURL || null
    };

    let updatedAccounts;
    if (index >= 0) {
      updatedAccounts = [...currentAccounts];
      updatedAccounts[index] = newAccount;
    } else {
      updatedAccounts = [...currentAccounts, newAccount];
    }

    await AsyncStorage.setItem(ACCOUNTS_KEY, JSON.stringify(updatedAccounts));
    console.log('✅ Cuenta guardada localmente:', user.email);
  } catch (e) {
    console.error('Error guardando cuenta:', e);
  }
};

export const removeAccount = async (uid) => {
  try {
    const currentAccounts = await getSavedAccounts();
    const filteredAccounts = currentAccounts.filter(acc => acc.uid !== uid);
    await AsyncStorage.setItem(ACCOUNTS_KEY, JSON.stringify(filteredAccounts));
    console.log('🗑️ Cuenta eliminada:', uid);
    return filteredAccounts;
  } catch (e) {
    console.error('Error eliminando cuenta:', e);
    return [];
  }
};
