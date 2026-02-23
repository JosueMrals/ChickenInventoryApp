import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "SELECTED_PRINTER";
const KEY_LIST = "SAVED_PRINTERS_LIST";

export async function savePrinter(printer) {
  await AsyncStorage.setItem(KEY, JSON.stringify(printer));
}

export async function loadPrinter() {
  const raw = await AsyncStorage.getItem(KEY);
  return raw ? JSON.parse(raw) : null;
}

export async function clearPrinter() {
  await AsyncStorage.removeItem(KEY);
}

export async function getSavedPrintersList() {
  try {
    const raw = await AsyncStorage.getItem(KEY_LIST);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error("Error loading printers list", e);
    return [];
  }
}

export async function addSavedPrinter(printer) {
  const list = await getSavedPrintersList();
  const exists = list.find((p) => p.address === printer.address);

  if (exists) return list;

  const newPrinter = { ...printer, customName: printer.name };
  const newList = [...list, newPrinter];
  await AsyncStorage.setItem(KEY_LIST, JSON.stringify(newList));
  return newList;
}

export async function removeSavedPrinter(address) {
  const list = await getSavedPrintersList();
  const newList = list.filter((p) => p.address !== address);
  await AsyncStorage.setItem(KEY_LIST, JSON.stringify(newList));

  const selected = await loadPrinter();
  if (selected && selected.address === address) {
    await clearPrinter();
  }

  return newList;
}

export async function updatePrinterName(address, newName) {
  const list = await getSavedPrintersList();
  const newList = list.map((p) => {
    if (p.address === address) {
      return { ...p, customName: newName };
    }
    return p;
  });
  await AsyncStorage.setItem(KEY_LIST, JSON.stringify(newList));

  const selected = await loadPrinter();
  if (selected && selected.address === address) {
    await savePrinter({ ...selected, customName: newName });
  }

  return newList;
}

