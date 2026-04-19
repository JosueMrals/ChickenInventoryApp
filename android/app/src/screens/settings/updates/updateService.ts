import {
  checkForUpdateSafe,
  downloadReleaseSafe,
  isAppDistributionSupported,
  isNotSupportedError,
} from '../../../services/appDistributionService';
import {
  checkPlayStoreUpdate,
  startFlexibleUpdate,
  startImmediateUpdate,
} from '../../../services/playStoreUpdateService';
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

/**
 * Intenta verificar actualizaciones via Google Play In-App Updates.
 * Retorna null si no esta disponible (ej. build de desarrollo o sideloaded).
 */
async function tryPlayStoreUpdate(localVersion: string): Promise<UpdateCheckResult | null> {
  try {
    const result = await checkPlayStoreUpdate();
    return {
      updatesSupported: true,
      isTester: false,
      localVersion,
      remoteVersion: result.storeVersion || localVersion,
      hasUpdate: result.updateAvailable,
      release: null,
      source: 'play-store',
      updatePriority: result.updatePriority,
    };
  } catch {
    // Play Store updates not available (e.g. not installed from Play Store)
    return null;
  }
}

/**
 * Intenta verificar actualizaciones via Firebase App Distribution (solo testers).
 */
async function tryAppDistributionUpdate(localVersion: string): Promise<UpdateCheckResult> {
  if (!isAppDistributionSupported()) {
    return {
      updatesSupported: false,
      isTester: false,
      localVersion,
      remoteVersion: localVersion,
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
      localVersion,
      remoteVersion: localVersion,
      hasUpdate: false,
      release: null,
      reason: tester.uid ? 'missing-auth-email' : 'missing-auth-session',
    };
  }

  try {
    const release = (await checkForUpdateSafe()) as unknown as FirebaseRelease | null;
    const remoteVersion = normalizeVersion(release?.displayVersion) || localVersion;

    return {
      updatesSupported: true,
      isTester: true,
      localVersion,
      remoteVersion,
      hasUpdate: Boolean(release),
      release,
      source: 'app-distribution',
    };
  } catch (error) {
    if (isNotSupportedError(error)) {
      return {
        updatesSupported: false,
        isTester: true,
        localVersion,
        remoteVersion: localVersion,
        hasUpdate: false,
        release: null,
        reason: 'unsupported-environment',
      };
    }

    if (isAppDistributionTesterAccessError(error)) {
      return {
        updatesSupported: true,
        isTester: false,
        localVersion,
        remoteVersion: localVersion,
        hasUpdate: false,
        release: null,
        reason: 'user-is-not-app-distribution-tester',
      };
    }

    throw error;
  }
}

/**
 * Verifica actualizaciones usando la fuente correcta:
 * 1. Primero intenta Google Play In-App Updates (para builds de Play Store).
 * 2. Si no esta disponible, intenta Firebase App Distribution (para testers).
 */
export async function checkForUpdates({ localVersion }: { localVersion: string }): Promise<UpdateCheckResult> {
  const normalizedLocal = normalizeVersion(localVersion);

  // Intentar Play Store primero (funciona solo si la app fue instalada desde Play Store)
  const playStoreResult = await tryPlayStoreUpdate(normalizedLocal);
  if (playStoreResult && playStoreResult.updatesSupported) {
    return playStoreResult;
  }

  // Fallback a Firebase App Distribution (para builds de testing)
  return tryAppDistributionUpdate(normalizedLocal);
}

/**
 * Inicia la descarga/instalacion de la actualizacion.
 * Selecciona automaticamente el metodo correcto segun la fuente.
 */
export async function startUpdate(result: UpdateCheckResult): Promise<void> {
  if (result.source === 'play-store') {
    // Prioridad >= 4 se considera critica -> actualizacion inmediata
    if ((result.updatePriority ?? 0) >= 4) {
      await startImmediateUpdate();
    } else {
      await startFlexibleUpdate();
    }
    return;
  }

  // App Distribution: usar el metodo de descarga del release
  if (result.release) {
    await downloadReleaseSafe(result.release);
  }
}

/**
 * @deprecated Use startUpdate(result) instead. Kept for backward compatibility.
 */
export async function startReleaseDownload(release: FirebaseRelease): Promise<unknown> {
  return downloadReleaseSafe(release);
}


