import { StyleSheet } from 'react-native';

const preSaleDoneScreenStyles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F5F6FA',
  },
  loadingScreen: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F6FA',
    gap: 12,
  },
  loadingText: {
    fontSize: 15,
    color: '#6B7280',
    fontWeight: '500',
  },

  // ── Header ────────────────────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Scroll ────────────────────────────────────────────────────────────────
  scrollArea: {
    flex: 1,
    backgroundColor: '#F5F6FA',
  },
  scrollContent: {
    paddingVertical: 8,
  },

  // ── Acciones ──────────────────────────────────────────────────────────────
  actions: {
    padding: 14,
    gap: 10,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  printBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#007AFF',
    borderRadius: 14,
    paddingVertical: 15,
    shadowColor: '#007AFF',
    shadowOpacity: 0.28,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  printBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#F3F4F6',
    borderRadius: 14,
    paddingVertical: 13,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  backBtnText: {
    color: '#374151',
    fontSize: 15,
    fontWeight: '700',
  },
  btnDisabled: {
    opacity: 0.6,
  },
});

export default preSaleDoneScreenStyles;


