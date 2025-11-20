import { PermissionsAndroid, Platform } from "react-native";

export async function requestBluetoothPermissions() {
  if (Platform.OS !== "android") {
    return true;
  }

  const permissions = [
    PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
    PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
  ];

  const granted = await PermissionsAndroid.requestMultiple(permissions);

  return Object.values(granted).every(
    (result) => result === PermissionsAndroid.RESULTS.GRANTED
  );
}
