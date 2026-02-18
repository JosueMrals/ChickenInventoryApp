import 'react-native-gesture-handler/jestSetup';

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
  });
  firestore.FieldValue = { serverTimestamp: jest.fn() };
  return firestore;
});
