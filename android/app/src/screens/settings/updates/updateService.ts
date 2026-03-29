import {
  checkForUpdateSafe,
  downloadReleaseSafe,
  isAppDistributionSupported,
  isNotSupportedError,
} from '../../../services/appDistributionService';
import { validateCurrentUserTester } from './testerProfile';
import type { FirebaseRelease, UpdateCheckResult } from './types';

function normalizeVersion(value: unknown): string {
  if (value === null || typeof value === 'undefined') return '';
  return String(value).trim();
}

function isAppDistributionTesterAccessError(error: unknown): boolean {
  const code = String((error as { code?: unknown })?.code || '').toLowerCase();
  const message = String((error as { message?: unknown })?.message || '').toLowerCase();

  return (
    code.includes('permission-denied') ||
    code.includes('unauthenticated') ||
    code.includes('forbidden') ||
    code.includes('app-distribution/unauthorized') ||
    message.includes('tester') ||
    message.includes('not authorized') ||
    message.includes('not invited') ||
    message.includes('permission')
  );
}

export { isNotSupportedError };

export async function checkForUpdates({ localVersion }: { localVersion: string }): Promise<UpdateCheckResult> {
  const normalizedLocal = normalizeVersion(localVersion);

  if (!isAppDistributionSupported()) {
    return {
      updatesSupported: false,
      isTester: false,
      localVersion: normalizedLocal,
      remoteVersion: normalizedLocal,
      hasUpdate: false,
      release: null,
      reason: 'unsupported-environment',
    };
  }

  const tester = await validateCurrentUserTester();
  if (!tester.isTester) {
    return {
      updatesSupported: true,
      isTester: false,
      localVersion: normalizedLocal,
      remoteVersion: normalizedLocal,
      hasUpdate: false,
      release: null,
      reason: tester.uid ? 'missing-auth-email' : 'missing-auth-session',
    };
  }

  try {
    const release = (await checkForUpdateSafe()) as FirebaseRelease | null;
    const remoteVersion = normalizeVersion(release?.displayVersion) || normalizedLocal;

    return {
      updatesSupported: true,
      isTester: true,
      localVersion: normalizedLocal,
      remoteVersion,
      hasUpdate: Boolean(release),
      release,
    };
  } catch (error) {
    if (isNotSupportedError(error)) {
      return {
        updatesSupported: false,
        isTester: true,
        localVersion: normalizedLocal,
        remoteVersion: normalizedLocal,
        hasUpdate: false,
        release: null,
        reason: 'unsupported-environment',
      };
    }

    if (isAppDistributionTesterAccessError(error)) {
      return {
        updatesSupported: true,
        isTester: false,
        localVersion: normalizedLocal,
        remoteVersion: normalizedLocal,
        hasUpdate: false,
        release: null,
        reason: 'user-is-not-app-distribution-tester',
      };
    }

    throw error;
  }
}

export async function startReleaseDownload(release: FirebaseRelease): Promise<unknown> {
  return downloadReleaseSafe(release);
}


