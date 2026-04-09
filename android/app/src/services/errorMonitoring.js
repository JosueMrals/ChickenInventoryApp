import crashlytics from '@react-native-firebase/crashlytics';

let isMonitoringInitialized = false;

const toSafeString = (value) => {
  if (value === null || value === undefined) return '';
  return String(value).slice(0, 120);
};

const toError = (unknownError) => {
  if (unknownError instanceof Error) {
    return unknownError;
  }

  return new Error(toSafeString(unknownError) || 'Unknown error');
};

export const captureError = (unknownError, context = {}) => {
  const error = toError(unknownError);

  try {
    const instance = crashlytics();

    Object.entries(context).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        instance.setAttribute(`ctx_${key}`, toSafeString(value));
      }
    });

    instance.recordError(error);
  } catch (monitoringError) {
    console.error('Error sending exception to Crashlytics:', monitoringError);
  }
};

const installGlobalJsErrorHandler = () => {
  const errorUtils = global.ErrorUtils;

  if (!errorUtils || typeof errorUtils.setGlobalHandler !== 'function') {
    return;
  }

  const previousHandler =
    typeof errorUtils.getGlobalHandler === 'function'
      ? errorUtils.getGlobalHandler()
      : null;

  errorUtils.setGlobalHandler((error, isFatal) => {
    captureError(error, { isFatal: Boolean(isFatal) });

    if (typeof previousHandler === 'function') {
      previousHandler(error, isFatal);
      return;
    }

    if (__DEV__) {
      console.error('Unhandled JS error:', error);
    }
  });
};

export const initializeErrorMonitoring = async () => {
  if (isMonitoringInitialized) {
    return;
  }

  try {
    const instance = crashlytics();
    await instance.setCrashlyticsCollectionEnabled(!__DEV__);
    instance.setAttribute('app_environment', __DEV__ ? 'development' : 'production');

    installGlobalJsErrorHandler();
    isMonitoringInitialized = true;
  } catch (error) {
    console.error('Error initializing Crashlytics:', error);
  }
};

export const setMonitoringUser = async (uid) => {
  try {
    await crashlytics().setUserId(uid ? String(uid) : 'anonymous');
  } catch (error) {
    console.error('Error setting Crashlytics user:', error);
  }
};

