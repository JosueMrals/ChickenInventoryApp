import { useState } from "react";
import { getBondedDevices } from "../../../helpers/getBondedDevices";
import { connectPrinter, disconnectPrinter } from "../services/printerService";

export function useBluetoothPrinters() {
  const [printers, setPrinters] = useState([]);
  const [scanning, setScanning] = useState(false);
  const [connectedPrinter, setConnectedPrinter] = useState(null);

  const scanPrinters = async () => {
    setScanning(true);
    try {
      const list = await getBondedDevices();
      setPrinters(list);
    } catch (e) {
      console.log(e);
    } finally {
      setScanning(false);
    }
  };

  const connect = async (device) => {
    try {
      await connectPrinter(device.address);
      setConnectedPrinter(device);
      return true;
    } catch (err) {
      console.log("Connection error:", err);
      return false;
    }
  };

  const disconnect = async () => {
    try {
      await disconnectPrinter();
      setConnectedPrinter(null);
    } catch (e) {
      console.log(e);
    }
  };

  return { printers, scanning, scanPrinters, connect, disconnect, connectedPrinter };
}
