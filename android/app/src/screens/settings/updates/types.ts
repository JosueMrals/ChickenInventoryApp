export type UserRole = 'admin' | 'bodeguero' | 'entregador' | 'tester' | 'user' | string;

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
}

export interface TesterProfileResult {
  isTester: boolean;
  role: UserRole | null;
  uid: string | null;
  email?: string | null;
}


