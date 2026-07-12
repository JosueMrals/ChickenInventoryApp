/**
 * @format
 */

import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';

import appCheck from '@react-native-firebase/app-check';
import { firebase } from '@react-native-firebase/app';
import { initializeErrorMonitoring } from './android/app/src/services/errorMonitoring';

// --- INICIALIZACIÓN DE APP CHECK ---
async function initializeAppCheck() {
  if (firebase.apps.length > 0) {
    const checkProvider = appCheck().newReactNativeFirebaseAppCheckProvider();
    checkProvider.configure({
      // Play Integrity solo valida apps instaladas vía Google Play en un dispositivo
      // certificado: en un build de debug/APK local SIEMPRE falla la atestación y no
      // se genera token → las Cloud Functions rechazan con "App Check requerido".
      // En debug usamos el proveedor 'debug' (requiere registrar el token una vez
      // en Firebase Console → App Check → Administrar tokens de depuración).
      android: __DEV__
        ? { provider: 'debug' }
        : { provider: 'playIntegrity' },
    });
    await appCheck().initializeAppCheck({
      provider: checkProvider,
      isTokenAutoRefreshEnabled: true,
    });
    console.log('✅ Firebase App Check inicializado correctamente.');

    // Diagnóstico: confirma que sí se puede obtener un token real, y lo
    // imprime para compararlo con lo que espera el backend. Sin este intento
    // explícito, un fallo silencioso en initializeAppCheck (promesa rechazada,
    // sin .catch) nunca se ve — la app sigue funcionando pero sin token.
    try {
      const { token } = await appCheck().getToken(true);
      console.log('✅ App Check token obtenido, longitud:', token?.length || 0);
    } catch (tokenError) {
      console.error('🔥 App Check: no se pudo obtener token:', tokenError);
    }
  }
}
initializeAppCheck().catch((initError) => {
  console.error('🔥 App Check: initializeAppCheck falló:', initError);
});
initializeErrorMonitoring();
// --- FIN DE LA INICIALIZACIÓN ---

AppRegistry.registerComponent(appName, () => App);
