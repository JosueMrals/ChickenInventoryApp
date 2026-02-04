import { Linking, Alert } from 'react-native';

/**
 * Abre WhatsApp con un mensaje preformateado.
 * @param {string} phone Número de teléfono en formato internacional (ej: 50588889999)
 * @param {string} message Mensaje a enviar
 */
export async function sendWhatsAppMessage(phone, message) {
  if (!phone || phone.length < 8) {
    Alert.alert('Número inválido', 'El cliente no tiene un número de teléfono válido.');
    return;
  }

  const formatted = phone.replace(/[^0-9]/g, '');
  const url = `https://wa.me/${formatted}?text=${encodeURIComponent(message)}`;

  try {
    const supported = await Linking.canOpenURL(url);
    if (supported) {
      await Linking.openURL(url);
    } else {
      Alert.alert('Error', 'No se pudo abrir WhatsApp en este dispositivo.');
    }
  } catch (e) {
    console.error('Error abriendo WhatsApp:', e);
    Alert.alert('Error', 'No se pudo abrir WhatsApp.');
  }
}
