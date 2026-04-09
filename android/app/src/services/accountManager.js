import AsyncStorage from '@react-native-async-storage/async-storage';
import EncryptedStorage from 'react-native-encrypted-storage';

const ACCOUNTS_KEY = 'saved_accounts_v1';

const parseAccounts = (rawValue) => {
  if (!rawValue) return [];

  try {
    const parsed = JSON.parse(rawValue);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const readSecureAccounts = async () => {
  const rawValue = await EncryptedStorage.getItem(ACCOUNTS_KEY);
  return parseAccounts(rawValue);
};

const writeSecureAccounts = async (accounts) => {
  await EncryptedStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
};

const migrateLegacyAccountsIfNeeded = async () => {
  const secureAccounts = await readSecureAccounts();
  if (secureAccounts.length > 0) {
    return secureAccounts;
  }

  const legacyRaw = await AsyncStorage.getItem(ACCOUNTS_KEY);
  const legacyAccounts = parseAccounts(legacyRaw);

  if (legacyAccounts.length === 0) {
    return [];
  }

  await writeSecureAccounts(legacyAccounts);
  await AsyncStorage.removeItem(ACCOUNTS_KEY);

  return legacyAccounts;
};

/**
 * Gestiona el almacenamiento de cuentas localmente.
 * Las credenciales se guardan en almacenamiento cifrado.
 * Si existen cuentas legacy en AsyncStorage, se migran de forma automática.
 */

export const getSavedAccounts = async () => {
  try {
    return await migrateLegacyAccountsIfNeeded();
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
      password,
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

    await writeSecureAccounts(updatedAccounts);
    console.log('✅ Cuenta guardada localmente:', user.email);
  } catch (e) {
    console.error('Error guardando cuenta:', e);
  }
};

export const removeAccount = async (uid) => {
  try {
    const currentAccounts = await getSavedAccounts();
    const filteredAccounts = currentAccounts.filter(acc => acc.uid !== uid);
    await writeSecureAccounts(filteredAccounts);
    console.log('🗑️ Cuenta eliminada:', uid);
    return filteredAccounts;
  } catch (e) {
    console.error('Error eliminando cuenta:', e);
    return [];
  }
};
