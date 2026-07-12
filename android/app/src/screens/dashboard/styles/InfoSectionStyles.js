import { StyleSheet } from 'react-native';

export default StyleSheet.create({
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#0A2540',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    minHeight: 52,
  },
  rowDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#E5E7EB',
    marginLeft: 58,
  },
  rowIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  rowLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  rowValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#8E8E93',
    marginRight: 6,
    maxWidth: 140,
  },

  // Variantes para valores largos que necesitan envolver (p. ej. nombre de ruta):
  // la etiqueta deja de ser flexible y el valor toma el espacio restante.
  rowLabelFixed: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1A1A',
    marginRight: 10,
  },
  rowValueWrap: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: '#8E8E93',
    textAlign: 'right',
    marginRight: 6,
  },
});
