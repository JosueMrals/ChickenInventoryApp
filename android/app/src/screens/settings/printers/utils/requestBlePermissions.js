import { PermissionsAndroid, Platform } from "react-native";

export async function requestBlePermissions() {
  if (Platform.OS !== "android") return true;

  try {
    const scan = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      {
        title: "Permiso para escanear Bluetooth",
        message: "La app necesita acceder al Bluetooth para encontrar impresoras",
        buttonPositive: "Aceptar",
      }
    );

    const connect = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      {
        title: "Permiso para conectar Bluetooth",
        message: "Permite conectar impresoras Bluetooth",
        buttonPositive: "Aceptar",
      }
    );

    const fine = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      {
        title: "Permiso de ubicación",
        message: "Requerido para escanear dispositivos Bluetooth cercanos",
        buttonPositive: "Aceptar",
      }
    );

    return (
      scan === PermissionsAndroid.RESULTS.GRANTED &&
      connect === PermissionsAndroid.RESULTS.GRANTED &&
      fine === PermissionsAndroid.RESULTS.GRANTED
    );
  } catch (err) {
    console.log("Permission error:", err);
    return false;
  }
}
