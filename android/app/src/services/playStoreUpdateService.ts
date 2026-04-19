import SpInAppUpdates, {
  IAUUpdateKind,
  type StartUpdateOptions,
} from 'sp-react-native-in-app-updates';

let inAppUpdatesInstance: SpInAppUpdates | null = null;

function getInAppUpdates(): SpInAppUpdates {
  if (!inAppUpdatesInstance) {
    inAppUpdatesInstance = new SpInAppUpdates(false);
  }
  return inAppUpdatesInstance;
}

export interface PlayStoreUpdateResult {
  updateAvailable: boolean;
  storeVersion: string | null;
  updatePriority: number;
}

/**
 * Verifica si hay una actualizacion disponible en Google Play Store.
 */
export async function checkPlayStoreUpdate(): Promise<PlayStoreUpdateResult> {
  const updater = getInAppUpdates();
  const result = await updater.checkNeedsUpdate();

  return {
    updateAvailable: result.shouldUpdate,
    storeVersion: result.storeVersion ?? null,
    updatePriority: (result.other as Record<string, unknown>)?.updatePriority as number ?? 0,
  };
}

/**
 * Inicia la actualizacion flexible (el usuario puede seguir usando la app).
 */
export async function startFlexibleUpdate(): Promise<void> {
  const updater = getInAppUpdates();
  const updateOptions: StartUpdateOptions = {
    updateType: IAUUpdateKind.FLEXIBLE,
  };
  await updater.startUpdate(updateOptions);
}

/**
 * Inicia la actualizacion inmediata (pantalla completa, fuerza actualizar).
 */
export async function startImmediateUpdate(): Promise<void> {
  const updater = getInAppUpdates();
  const updateOptions: StartUpdateOptions = {
    updateType: IAUUpdateKind.IMMEDIATE,
  };
  await updater.startUpdate(updateOptions);
}
