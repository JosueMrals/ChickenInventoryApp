/**
 * @format
 */

import { AppRegistry } from 'react-native';
// Debe ir ANTES de './App': configura la caché de Firestore antes de que se evalúe
// el árbol de pantallas y se ejecute la primera operación.
import './android/app/src/services/firebase';
import App from './App';
import { name as appName } from './app.json';

import appCheck from '@react-native-firebase/app-check';
import { firebase } from '@react-native-firebase/app';
import { initializeErrorMonitoring, captureError } from './android/app/src/services/errorMonitoring';

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

    // Diagnóstico: confirma que sí se puede obtener un token real. Sin este
    // intento explícito, un fallo silencioso en initializeAppCheck nunca se ve —
    // la app sigue funcionando pero sin token y las Cloud Functions responden
    // "App Check requerido". En release console.log no se ve en ningún lado, así
    // que el fallo va a Crashlytics: es la única forma de diagnosticar la app de
    // Play Store (atestación de Play Integrity rechazada, SHA-256 no registrado…).
    try {
      const { token } = await appCheck().getToken(true);
      console.log('✅ App Check token obtenido, longitud:', token?.length || 0);
    } catch (tokenError) {
      console.error('🔥 App Check: no se pudo obtener token:', tokenError);
      captureError(tokenError, { scope: 'appCheck.getToken', provider: __DEV__ ? 'debug' : 'playIntegrity' });
    }
  }
}
initializeAppCheck().catch((initError) => {
  console.error('🔥 App Check: initializeAppCheck falló:', initError);
  captureError(initError, { scope: 'appCheck.initialize', provider: __DEV__ ? 'debug' : 'playIntegrity' });
});
initializeErrorMonitoring();
// --- FIN DE LA INICIALIZACIÓN ---

AppRegistry.registerComponent(appName, () => App);
