import { Platform } from 'react-native';
import appDistribution from '@react-native-firebase/app-distribution';

export function isNotSupportedError(error) {
  const code = String(error?.code || '').toLowerCase();
  const message = String(error?.message || '').toLowerCase();
  return code.includes('not-supported') || message.includes('not supported');
}

export function isAppDistributionSupported({ allowInDebug = false } = {}) {
  if (!allowInDebug && __DEV__) return false;
  if (Platform.OS !== 'android' && Platform.OS !== 'ios') return false;
  return typeof appDistribution === 'function';
}

export async function checkForUpdateSafe(options = {}) {
  if (!isAppDistributionSupported(options)) {
    const err = new Error('App Distribution is not supported on this platform.');
    err.code = 'app-distribution/not-supported';
    throw err;
  }
  return appDistribution().checkForUpdate();
}

export async function downloadReleaseSafe(release) {
  if (!release || typeof release.download !== 'function') {
    throw new Error('Release download is not available.');
  }
  return release.download();
}

