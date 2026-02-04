//import AsyncStorage from "@react-native-async-storage/async-storage";
////import { BluetoothEscposPrinter } from "react-native-bluetooth-escpos-printer";
//
//const KEY = "SELECTED_PRINTER";
//
//// Guardar impresora
//export async function savePrinter(printer) {
//  await AsyncStorage.setItem(KEY, JSON.stringify(printer));
//}
//
//export async function loadPrinter() {
//  const raw = await AsyncStorage.getItem(KEY);
//  return raw ? JSON.parse(raw) : null;
//}
//
//export async function clearPrinter() {
//  await AsyncStorage.removeItem(KEY);
//}
//
///**
// * Generar recibo 58mm optimizado para HOIN
// * - 32 caracteres por línea
// */
//export function build58mmReceipt(sale) {
//  const methodNames = {
//    cash: "Efectivo",
//    transfer: "Transferencia",
//    card: "Tarjeta",
//    credit: "Crédito",
//  };
//
//  const line = "--------------------------------\n";
//
//  let text = "";
//  text += "   CHICKEN INVENTORY APP\n";
//  text += "       TICKET DE VENTA\n";
//  text += line;
//
//  text += `Cliente: ${sale.customerName || "Genérico"}\n`;
//  text += `Usuario: ${sale.userName || "---"}\n`;
//  text += `Fecha: ${new Date(sale.date).toLocaleString()}\n`;
//  text += line;
//
//  text += "Producto          Cnt     Subt\n";
//
//  sale.items.forEach((item) => {
//    const name = (item.name || item.product?.name || "Item").slice(0, 14);
//    const qty = String(item.qty || item.quantity || 1).padStart(3, " ");
//    const price = Number(item.price || item.unitPrice || 0);
//    const subtotal = price * (item.qty || 1);
//
//    const subStr = subtotal.toFixed(2).padStart(8, " ");
//    text += `${name.padEnd(14, " ")} ${qty}   ${subStr}\n`;
//  });
//
//  text += line;
//
//  text += `Subtotal:  C$${(sale.subtotal ?? 0).toFixed(2)}\n`;
//  text += `Descuento: C$${(sale.discountAmount ?? 0).toFixed(2)}\n`;
//  text += `TOTAL:     C$${(sale.total ?? 0).toFixed(2)}\n`;
//  text += `Pagado:    C$${(sale.paidAmount ?? 0).toFixed(2)}\n`;
//  text += `Método:    ${methodNames[sale.paymentMethod] || sale.paymentMethod}\n`;
//
//  if (sale.transferNumber) {
//    text += `Ref: ${sale.transferNumber}\n`;
//  }
//
//  text += line;
//  text += "Gracias por su compra\n\n\n";
//
//  return text;
//}
//
///**
// * Función para imprimir el recibo completo en impresora HOIN
// */
//export async function printSaleHoin(sale) {
//  const device = await loadPrinter();
//  if (!device) throw new Error("No hay impresora seleccionada.");
//
//  await BluetoothEscposPrinter.connectPrinter(device.address);
//
//  // Inicializar
//  await BluetoothEscposPrinter.printerInit();
//  await BluetoothEscposPrinter.printerAlign(
//    BluetoothEscposPrinter.ALIGN.LEFT
//  );
//
//  // Generar recibo
//  const text = build58mmReceipt(sale);
//
//  // Imprimir con codificación GBK (preferida por HOIN)
//  await BluetoothEscposPrinter.printText(text, {
//    encoding: "GBK",
//    codepage: 0,
//    widthtimes: 0,
//    heigthtimes: 0,
//  });
//
//  await BluetoothEscposPrinter.cutPaper();
//}
