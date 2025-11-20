import { useState, useEffect } from "react";
import { BleManager } from "react-native-ble-plx";

export function useBluetoothPrinters() {
  const manager = new BleManager();
  const [printers, setPrinters] = useState([]);
  const [scanning, setScanning] = useState(false);
  const [connectedPrinter, setConnectedPrinter] = useState(null);

  const scanPrinters = () => {
    setScanning(true);
    setPrinters([]);

    manager.startDeviceScan(null, null, (error, device) => {
      if (error) {
        console.log("Scan error:", error);
        setScanning(false);
        return;
      }

      if (device.name?.toLowerCase().includes("printer")) {
        setPrinters(prev => [...prev, device]);
      }
    });

    setTimeout(() => {
      manager.stopDeviceScan();
      setScanning(false);
    }, 5000);
  };

  const connect = async (device) => {
    try {
      const connected = await manager.connectToDevice(device.id);
      await connected.discoverAllServicesAndCharacteristics();
      setConnectedPrinter(connected);
      return true;
    } catch (err) {
      console.log("Connection error:", err);
      return false;
    }
  };

  const disconnect = async () => {
    if (connectedPrinter) {
      await manager.cancelDeviceConnection(connectedPrinter.id);
      setConnectedPrinter(null);
    }
  };

  return { printers, scanning, scanPrinters, connect, disconnect, connectedPrinter };
}
