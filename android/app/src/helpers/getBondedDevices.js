import { NativeModules } from "react-native";
const { BondedDevicesModule } = NativeModules;

export async function getBondedDevices() {
  try {
    const devices = await BondedDevicesModule.getBondedDevices();
    return devices;
  } catch (e) {
    console.log("Bonded device error:", e);
    return [];
  }
}
