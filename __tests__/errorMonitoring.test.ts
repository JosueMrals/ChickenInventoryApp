import crashlytics from '@react-native-firebase/crashlytics';
import {
  initializeErrorMonitoring,
  captureError,
  setMonitoringUser,
} from '../android/app/src/services/errorMonitoring';

type ErrorUtilsLike = {
  getGlobalHandler: jest.Mock;
  setGlobalHandler: jest.Mock;
};

describe('errorMonitoring service', () => {
  const originalDev = global.__DEV__;
  const originalErrorUtils = global.ErrorUtils as unknown;

  beforeEach(() => {
    jest.clearAllMocks();

    global.__DEV__ = false;
    global.ErrorUtils = {
      getGlobalHandler: jest.fn(() => null),
      setGlobalHandler: jest.fn(),
    } as unknown as ErrorUtilsLike;
  });

  afterAll(() => {
    global.__DEV__ = originalDev;
    global.ErrorUtils = originalErrorUtils as typeof global.ErrorUtils;
  });

  test('initializeErrorMonitoring configura Crashlytics e instala handler global', async () => {
    await initializeErrorMonitoring();

    expect(crashlytics().setCrashlyticsCollectionEnabled).toHaveBeenCalledWith(true);
    expect(crashlytics().setAttribute).toHaveBeenCalledWith('app_environment', 'production');
    expect((global.ErrorUtils as unknown as ErrorUtilsLike).setGlobalHandler).toHaveBeenCalled();
  });

  test('captureError reporta excepcion incluso si no recibe Error', () => {
    captureError('fallo de prueba', { screen: 'Login' });

    expect(crashlytics().setAttribute).toHaveBeenCalledWith('ctx_screen', 'Login');
    expect(crashlytics().recordError).toHaveBeenCalledTimes(1);
  });

  test('setMonitoringUser envia uid normalizado a Crashlytics', async () => {
    await setMonitoringUser(12345);

    expect(crashlytics().setUserId).toHaveBeenCalledWith('12345');
  });
});



