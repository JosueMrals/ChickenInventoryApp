import AsyncStorage from "@react-native-async-storage/async-storage";

const SESSION_KEY = "lastActivity";
const TIMEOUT_MINUTES = 15;

export const SessionManager = {
  async updateActivity() {
    const now = Date.now();
    await AsyncStorage.setItem(SESSION_KEY, String(now));
  },

  async hasSessionExpired() {
    const saved = await AsyncStorage.getItem(SESSION_KEY);
    if (!saved) return true;

    const last = parseInt(saved, 10);
    const now = Date.now();

    const diffMinutes = (now - last) / 1000 / 60;

    return diffMinutes >= TIMEOUT_MINUTES;
  },

  async clear() {
    await AsyncStorage.removeItem(SESSION_KEY);
  }
};
