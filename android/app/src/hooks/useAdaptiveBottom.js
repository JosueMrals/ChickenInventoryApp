import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Platform } from 'react-native';

/**
 * Hook que retorna el padding inferior adaptativo según el dispositivo.
 *
 * - Dispositivos con gestos (sin botones): insets.bottom ≈ 20-34px
 * - Dispositivos con botones de navegación: insets.bottom ≈ 0px
 *
 * @param {number} minPadding - Padding mínimo cuando no hay insets (default: 16)
 * @returns {{ bottomPadding: number, insets: object }}
 */
export function useAdaptiveBottom(minPadding = 16) {
  const insets = useSafeAreaInsets();
  const bottomPadding = Math.max(insets.bottom, minPadding);
  return { bottomPadding, insets };
}

