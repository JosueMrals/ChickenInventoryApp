/**
 * @format
 */

import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';

import appCheck from '@react-native-firebase/app-check';
import { firebase } from '@react-native-firebase/app';

// --- INICIALIZACIÓN DE APP CHECK ---
async function initializeAppCheck() {
  if (firebase.apps.length > 0) {
    const checkProvider = appCheck().newReactNativeFirebaseAppCheckProvider();
    checkProvider.configure({
      android: {
        provider: 'playIntegrity', // o 'safetyNet' si Play Integrity no está configurado
        // debugToken: 'TU_DEBUG_TOKEN_AQUI', // Opcional, para emuladores
      },
    });
    await appCheck().initializeAppCheck({
      provider: checkProvider,
      isTokenAutoRefreshEnabled: true,
    });
    console.log('✅ Firebase App Check inicializado correctamente.');
  }
}
initializeAppCheck();
// --- FIN DE LA INICIALIZACIÓN ---

AppRegistry.registerComponent(appName, () => App);
