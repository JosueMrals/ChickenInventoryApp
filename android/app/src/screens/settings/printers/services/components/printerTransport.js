import RNBluetoothClassic from "react-native-bluetooth-classic";
import { encode as btoa } from "base-64";

let connectedDevice = null;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const LATIN_MAP = {
  "á": 160, "í": 161, "ó": 162, "ú": 163, "ñ": 164, "Ñ": 165,
  "é": 130, "É": 144,
  "ª": 166, "º": 167, "¿": 168, "Á": 181, "Í": 214, "Ó": 224,
  "Ú": 233, "ü": 129, "Ü": 154, "¡": 173,
  "€": 238
};

function encodeToCP437(str) {
  const bytes = [];
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    const code = str.charCodeAt(i);

    if (LATIN_MAP[char]) {
      bytes.push(LATIN_MAP[char]);
    } else if (code >= 32 && code <= 126) {
      bytes.push(code);
    } else if (code < 32 || code === 27 || code === 29) {
      bytes.push(code);
    } else {
      bytes.push(63);
    }
  }
  return bytes;
}

export async function ensureConnection(address) {
  if (connectedDevice && connectedDevice.address === address) {
    const isConnected = await connectedDevice.isConnected();
    if (isConnected) {
      return connectedDevice;
    }
  }

  try {
    if (connectedDevice) {
      await connectedDevice.disconnect();
    }

    console.log("Conectando a:", address);
    const bonded = await RNBluetoothClassic.getBondedDevices();
    const device = bonded.find(d => d.address === address || d.id === address);

    if (!device) {
      throw new Error("Dispositivo no encontrado en vinculados");
    }

    const connected = await device.connect({
      connectorType: "rfcomm",
      SECURE_SOCKET: false
    });

    if (connected) {
      connectedDevice = device;
      return device;
    }

    throw new Error("No se pudo conectar");
  } catch (e) {
    connectedDevice = null;
    throw e;
  }
}

export async function disconnectPrinter() {
  if (connectedDevice) {
    await connectedDevice.disconnect();
    connectedDevice = null;
  }
}

export async function printRaw(textOrBytes, device) {
  let bytesArray;
  if (typeof textOrBytes === "string") {
    bytesArray = encodeToCP437(textOrBytes);
  } else if (Array.isArray(textOrBytes)) {
    bytesArray = textOrBytes;
  } else if (textOrBytes instanceof Uint8Array) {
    bytesArray = Array.from(textOrBytes);
  } else {
    throw new Error("Tipo de dato no soportado para impresión");
  }

  const CHUNK_SIZE = 200;

  for (let i = 0; i < bytesArray.length; i += CHUNK_SIZE) {
    const chunk = bytesArray.slice(i, i + CHUNK_SIZE);
    let binary = "";
    for (let j = 0; j < chunk.length; j++) {
      binary += String.fromCharCode(chunk[j]);
    }

    const base64 = btoa(binary);

    try {
      await device.write(base64, "base64");
      await sleep(20);
    } catch (e) {
      console.error("Error sending chunk", e);
      throw e;
    }
  }

  return true;
}

export async function printTicket(payload, printer) {
  if (!printer) throw new Error("No hay impresora seleccionada.");
  const deviceObj = await ensureConnection(printer.address);
  await printRaw(payload, deviceObj);
}

