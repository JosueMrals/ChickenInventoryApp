import AsyncStorage from '@react-native-async-storage/async-storage';
import EncryptedStorage from 'react-native-encrypted-storage';
import { getSavedAccounts, saveAccount, removeAccount } from '../android/app/src/services/accountManager';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

jest.mock('react-native-encrypted-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}), { virtual: true });

const ACCOUNTS_KEY = 'saved_accounts_v1';

describe('accountManager secure storage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('retorna [] cuando no hay cuentas', async () => {
    EncryptedStorage.getItem.mockResolvedValue(null);
    AsyncStorage.getItem.mockResolvedValue(null);

    const accounts = await getSavedAccounts();

    expect(accounts).toEqual([]);
    expect(EncryptedStorage.getItem).toHaveBeenCalledWith(ACCOUNTS_KEY);
  });

  test('migra cuentas legacy desde AsyncStorage a EncryptedStorage', async () => {
    const legacyAccounts = [{ uid: 'u1', email: 'a@x.com', password: '1234' }];

    EncryptedStorage.getItem.mockResolvedValue(null);
    AsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify(legacyAccounts));

    const accounts = await getSavedAccounts();

    expect(accounts).toEqual(legacyAccounts);
    expect(EncryptedStorage.setItem).toHaveBeenCalledWith(
      ACCOUNTS_KEY,
      JSON.stringify(legacyAccounts),
    );
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith(ACCOUNTS_KEY);
  });

  test('guarda o actualiza cuenta en storage cifrado', async () => {
    const currentAccounts = [
      {
        uid: 'u1',
        email: 'old@x.com',
        displayName: 'old',
        role: 'user',
        password: 'old-pass',
        lastLogin: '2020-01-01T00:00:00.000Z',
        photoURL: null,
      },
    ];

    EncryptedStorage.getItem.mockResolvedValueOnce(JSON.stringify(currentAccounts));

    await saveAccount(
      { uid: 'u1', email: 'new@x.com', displayName: 'new', photoURL: null },
      'new-pass',
      'admin',
    );

    const [, rawSaved] = EncryptedStorage.setItem.mock.calls[0];
    const savedAccounts = JSON.parse(rawSaved);

    expect(savedAccounts).toHaveLength(1);
    expect(savedAccounts[0].email).toBe('new@x.com');
    expect(savedAccounts[0].password).toBe('new-pass');
    expect(savedAccounts[0].role).toBe('admin');
  });

  test('elimina cuenta por uid y devuelve la lista resultante', async () => {
    const currentAccounts = [
      { uid: 'u1', email: 'a@x.com', password: '1' },
      { uid: 'u2', email: 'b@x.com', password: '2' },
    ];

    EncryptedStorage.getItem.mockResolvedValueOnce(JSON.stringify(currentAccounts));

    const updated = await removeAccount('u1');

    expect(updated).toEqual([{ uid: 'u2', email: 'b@x.com', password: '2' }]);
    expect(EncryptedStorage.setItem).toHaveBeenCalledWith(
      ACCOUNTS_KEY,
      JSON.stringify(updated),
    );
  });
});




