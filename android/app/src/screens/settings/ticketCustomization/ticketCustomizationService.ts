import AsyncStorage from '@react-native-async-storage/async-storage';
import auth from '@react-native-firebase/auth';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TicketSettings {
  headerImageUri: string;
  headerImageBase64: string;
  fontFamily: string;
  fontSize: number;
  paperWidthMm: number;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const SETTINGS_KEY = 'ticket_customization_settings_v1';

export const DEFAULT_TICKET_SETTINGS: TicketSettings = {
  headerImageUri: '',
  headerImageBase64: '',
  fontFamily: 'System',
  fontSize: 16,
  paperWidthMm: 58,   // 80 mm por defecto → impresión más grande (576px raster)
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const getUserId = (userId?: string | null): string | null =>
  userId || auth().currentUser?.uid || null;

const getSettingsKey = (userId: string | null): string =>
  userId ? `${SETTINGS_KEY}_${userId}` : SETTINGS_KEY;

// ── Service functions ─────────────────────────────────────────────────────────

export async function getTicketCustomizationSettings(
  userId?: string | null,
): Promise<TicketSettings> {
  try {
    const uid = getUserId(userId);
    const key = getSettingsKey(uid);
    const raw = await AsyncStorage.getItem(key);

    if (!raw && uid) {
      // Migración desde clave legacy (sin userId)
      const legacyRaw = await AsyncStorage.getItem(SETTINGS_KEY);
      if (legacyRaw) {
        await AsyncStorage.setItem(key, legacyRaw);
        const parsedLegacy = JSON.parse(legacyRaw) as Partial<TicketSettings>;
        return { ...DEFAULT_TICKET_SETTINGS, ...parsedLegacy };
      }
    }

    if (!raw) return { ...DEFAULT_TICKET_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<TicketSettings>;
    return { ...DEFAULT_TICKET_SETTINGS, ...parsed };
  } catch (error) {
    console.log('Ticket settings read error:', error);
    return { ...DEFAULT_TICKET_SETTINGS };
  }
}

export async function saveTicketCustomizationSettings(
  nextSettings: Partial<TicketSettings>,
  userId?: string | null,
): Promise<TicketSettings> {
  const normalized: TicketSettings = { ...DEFAULT_TICKET_SETTINGS, ...nextSettings };
  const uid = getUserId(userId);
  const key = getSettingsKey(uid);
  await AsyncStorage.setItem(key, JSON.stringify(normalized));
  return normalized;
}

export async function resetTicketCustomizationSettings(
  userId?: string | null,
): Promise<TicketSettings> {
  const uid = getUserId(userId);
  const key = getSettingsKey(uid);
  await AsyncStorage.removeItem(key);
  return { ...DEFAULT_TICKET_SETTINGS };
}


