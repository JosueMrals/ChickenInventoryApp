import RNBluetoothClassic from "react-native-bluetooth-classic";

export async function getBondedDevices() {
  try {
    const devices = await RNBluetoothClassic.getBondedDevices();
    // Mapear al formato que espera la UI { name, address }
    return devices.map(d => ({
        name: d.name || "Desconocido",
        address: d.address,
        id: d.id, // RNBluetoothClassic usa 'id' a veces como mac address
        ...d
    }));
  } catch (e) {
    console.warn("Error getting bonded devices:", e);
    return [];
  }
}
