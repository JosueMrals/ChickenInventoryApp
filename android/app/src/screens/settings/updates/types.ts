export type UserRole = 'admin' | 'bodeguero' | 'entregador' | 'tester' | 'user' | string;

export type UpdateSource = 'play-store' | 'app-distribution';

export interface FirebaseRelease {
  displayVersion?: string;
  versionCode?: number | string;
  downloadUrl?: string;
  downloadURL?: string;
  download?: () => Promise<unknown>;
  [key: string]: unknown;
}

export interface UpdateCheckResult {
  updatesSupported: boolean;
  isTester: boolean;
  localVersion: string;
  remoteVersion: string;
  hasUpdate: boolean;
  release: FirebaseRelease | null;
  reason?: string;
  /** Indica la fuente de la actualizacion: 'play-store' o 'app-distribution' */
  source?: UpdateSource;
  /** Prioridad de la actualizacion (solo Play Store, 0-5) */
  updatePriority?: number;
}

export interface TesterProfileResult {
  isTester: boolean;
  role: UserRole | null;
  uid: string | null;
  email?: string | null;
}


