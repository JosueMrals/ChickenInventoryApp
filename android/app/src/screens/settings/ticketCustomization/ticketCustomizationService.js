import AsyncStorage from '@react-native-async-storage/async-storage';
import auth from '@react-native-firebase/auth';

const SETTINGS_KEY = 'ticket_customization_settings_v1';

const getUserId = (userId) => userId || auth().currentUser?.uid || null;
const getSettingsKey = (userId) => (userId ? `${SETTINGS_KEY}_${userId}` : SETTINGS_KEY);

export const DEFAULT_TICKET_SETTINGS = {
  headerImageUri: '',
  headerImageBase64: '',
  fontFamily: 'System',
  fontSize: 12,
  paperWidthMm: 68,
};

export async function getTicketCustomizationSettings(userId) {
  try {
    const uid = getUserId(userId);
    const key = getSettingsKey(uid);
    const raw = await AsyncStorage.getItem(key);

    if (!raw && uid) {
      const legacyRaw = await AsyncStorage.getItem(SETTINGS_KEY);
      if (legacyRaw) {
        await AsyncStorage.setItem(key, legacyRaw);
        const parsedLegacy = JSON.parse(legacyRaw);
        return { ...DEFAULT_TICKET_SETTINGS, ...parsedLegacy };
      }
    }

    if (!raw) return { ...DEFAULT_TICKET_SETTINGS };
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_TICKET_SETTINGS, ...parsed };
  } catch (error) {
    console.log('Ticket settings read error:', error);
    return { ...DEFAULT_TICKET_SETTINGS };
  }
}

export async function saveTicketCustomizationSettings(nextSettings, userId) {
  const normalized = { ...DEFAULT_TICKET_SETTINGS, ...nextSettings };
  const uid = getUserId(userId);
  const key = getSettingsKey(uid);
  await AsyncStorage.setItem(key, JSON.stringify(normalized));
  return normalized;
}

export async function resetTicketCustomizationSettings(userId) {
  const uid = getUserId(userId);
  const key = getSettingsKey(uid);
  await AsyncStorage.removeItem(key);
  return { ...DEFAULT_TICKET_SETTINGS };
}
