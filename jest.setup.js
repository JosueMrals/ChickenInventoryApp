import 'react-native-gesture-handler/jestSetup';

// Mock oficial que publica la propia librería.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('react-native-encrypted-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
}), { virtual: true });

jest.mock('react-native-worklets', () => ({
  createRunOnJS: () => () => {},
  createRunOnUI: () => () => {},
  runOnJS: (fn) => fn,
  runOnUI: (fn) => fn,
}));

jest.mock('react-native-reanimated', () => {
  const createAnimatedComponent = (Component) => Component;

  return {
    __esModule: true,
    default: { call: () => {}, createAnimatedComponent },
    Animated: { createAnimatedComponent },
    createAnimatedComponent,
    useSharedValue: (value) => ({ value }),
    useAnimatedStyle: () => ({}),
    useAnimatedProps: () => ({}),
    useDerivedValue: (fn) => ({ value: fn() }),
    useAnimatedRef: () => ({ current: null }),
    useAnimatedScrollHandler: () => () => {},
    useAnimatedReaction: () => {},
    runOnJS: (fn) => fn,
    runOnUI: (fn) => fn,
    withTiming: (v) => v,
    withSpring: (v) => v,
    withDecay: (v) => v,
    withDelay: (_d, v) => v,
    withRepeat: (v) => v,
    cancelAnimation: () => {},
    interpolate: () => 0,
    Extrapolation: { EXTEND: 'extend', CLAMP: 'clamp', IDENTITY: 'identity' },
    Easing: {
      linear: (x) => x,
      ease: (x) => x,
      quad: (x) => x,
      cubic: (x) => x,
      poly: (x) => x,
      sin: (x) => x,
      circle: (x) => x,
      exp: (x) => x,
      elastic: (x) => x,
      back: (x) => x,
      bounce: (x) => x,
      bezier: () => ({}),
      bezierFn: (x) => x,
      steps: () => (x) => x,
      in: (x) => x,
      out: (x) => x,
      inOut: (x) => x,
    },
  };
});

// ── Hardware y módulos nativos: no existen bajo Jest ─────────────────────────
jest.mock('react-native-bluetooth-classic', () => ({
  __esModule: true,
  default: {
    isBluetoothEnabled: jest.fn().mockResolvedValue(false),
    getBondedDevices: jest.fn().mockResolvedValue([]),
    connectToDevice: jest.fn(),
    onDeviceDisconnected: jest.fn(() => ({ remove: jest.fn() })),
  },
}));

jest.mock('react-native-ble-plx', () => ({
  BleManager: class {
    destroy() {}
    onStateChange() { return { remove: jest.fn() }; }
    startDeviceScan() {}
    stopDeviceScan() {}
  },
}));

jest.mock('react-native-vision-camera', () => ({
  Camera: () => null,
  useCameraDevice: () => null,
  useCameraPermission: () => ({ hasPermission: false, requestPermission: jest.fn() }),
  useCodeScanner: () => ({}),
}));

jest.mock('@react-native-ml-kit/barcode-scanning', () => ({
  __esModule: true,
  default: { scan: jest.fn().mockResolvedValue([]) },
}));

jest.mock('react-native-view-shot', () => ({
  __esModule: true,
  default: () => null,
  captureRef: jest.fn().mockResolvedValue('file://mock.png'),
}));

jest.mock('react-native-share', () => ({
  __esModule: true,
  default: { open: jest.fn().mockResolvedValue({}) },
}));

jest.mock('react-native-fs', () => ({
  DocumentDirectoryPath: '/mock',
  writeFile: jest.fn().mockResolvedValue(),
  readFile: jest.fn().mockResolvedValue(''),
  unlink: jest.fn().mockResolvedValue(),
  exists: jest.fn().mockResolvedValue(false),
}));

jest.mock('react-native-print', () => ({
  __esModule: true,
  default: { print: jest.fn().mockResolvedValue() },
}));

jest.mock('react-native-html-to-pdf', () => ({
  __esModule: true,
  default: { convert: jest.fn().mockResolvedValue({ filePath: '/mock.pdf' }) },
}));

jest.mock('react-native-device-info', () => ({
  __esModule: true,
  default: {
    getVersion: () => '1.0.0',
    getBuildNumber: () => '1',
    getUniqueId: () => Promise.resolve('mock-device'),
  },
}));

jest.mock('@bam.tech/react-native-image-resizer', () => ({
  __esModule: true,
  default: { createResizedImage: jest.fn().mockResolvedValue({ uri: 'file://mock.jpg' }) },
}));

jest.mock('react-native-image-picker', () => ({
  launchCamera: jest.fn().mockResolvedValue({ didCancel: true }),
  launchImageLibrary: jest.fn().mockResolvedValue({ didCancel: true }),
}));

jest.mock('@react-native-firebase/app', () => ({
  __esModule: true,
  default: () => ({ name: 'mock-app', options: {}, utils: () => ({}) }),
  firebase: { app: () => ({}) },
  initializeApp: () => ({ name: 'mock-app', options: {} }),
}));

jest.mock('@react-native-firebase/auth', () => {
  const auth = () => ({
    currentUser: null,
    onAuthStateChanged: (cb) => {
      cb(null);
      return () => {};
    },
    signOut: jest.fn(),
    signInWithEmailAndPassword: jest.fn(),
    createUserWithEmailAndPassword: jest.fn(),
    sendPasswordResetEmail: jest.fn(),
  });
  auth.Auth = {};
  return auth;
});

jest.mock('@react-native-firebase/app-check', () => {
  const appCheck = () => ({
    activate: jest.fn(),
    setTokenAutoRefreshEnabled: jest.fn(),
  });
  return appCheck;
});

jest.mock('@react-native-firebase/app-distribution', () => {
  const appDistribution = () => ({
    checkForUpdate: jest.fn(),
    signInTester: jest.fn(),
  });
  return appDistribution;
});

jest.mock('sp-react-native-in-app-updates', () => {
  const IAUUpdateKind = { FLEXIBLE: 0, IMMEDIATE: 1 };
  class SpInAppUpdates {
    constructor() {}
    checkNeedsUpdate() {
      return Promise.resolve({
        shouldUpdate: false,
        storeVersion: '1.0.0',
        other: { updatePriority: 0 },
      });
    }
    startUpdate() {
      return Promise.resolve();
    }
  }
  SpInAppUpdates.IAUUpdateKind = IAUUpdateKind;
  return {
    __esModule: true,
    default: SpInAppUpdates,
    IAUUpdateKind,
  };
});

jest.mock('@react-native-firebase/crashlytics', () => {
  const crashlyticsInstance = {
    setCrashlyticsCollectionEnabled: jest.fn(),
    setAttribute: jest.fn(),
    recordError: jest.fn(),
    setUserId: jest.fn(),
  };
  const crashlytics = () => crashlyticsInstance;
  return crashlytics;
}, { virtual: true });

jest.mock('@react-native-firebase/storage', () => {
  const storage = () => ({
    ref: () => ({
      putFile: jest.fn().mockResolvedValue({}),
      getDownloadURL: jest.fn().mockResolvedValue('https://mock/photo.jpg'),
      delete: jest.fn().mockResolvedValue(),
    }),
  });
  return storage;
});

jest.mock('@react-native-firebase/functions', () => {
  const functions = () => ({
    httpsCallable: () => jest.fn().mockResolvedValue({ data: {} }),
    useEmulator: jest.fn(),
  });
  return functions;
});

jest.mock('@react-native-firebase/firestore', () => {
  const firestore = () => ({
    collection: () => ({
      doc: () => ({
        onSnapshot: () => () => {},
        get: jest.fn(),
        set: jest.fn(),
        update: jest.fn(),
      }),
      where: () => ({
        onSnapshot: () => () => {},
        get: jest.fn(),
      }),
      add: jest.fn(),
      get: jest.fn(),
    }),
    // services/firebase.js configura la caché al importarse (ver index.js)
    settings: jest.fn(),
  });
  firestore.FieldValue = { serverTimestamp: jest.fn(), increment: jest.fn() };
  firestore.CACHE_SIZE_UNLIMITED = -1;
  return firestore;
});
