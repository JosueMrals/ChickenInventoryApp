import { StyleSheet } from 'react-native';

export default StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  emptyText: { fontSize: 12, color: '#9A93AA', fontWeight: '600', fontStyle: 'italic' },

  thumbWrap: {
    width: 68, height: 68, borderRadius: 14, overflow: 'visible',
    borderWidth: 1.5, borderColor: '#E3DEF5',
  },
  thumb: { width: '100%', height: '100%', borderRadius: 12, backgroundColor: '#F4F1FA' },

  deleteBadge: {
    position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: 10,
    backgroundColor: '#DC2626', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: '#fff', elevation: 3,
  },

  viewerBackdrop: { flex: 1, backgroundColor: 'rgba(20,16,28,0.92)', alignItems: 'center', justifyContent: 'center' },
  viewerImage: { width: '100%', height: '80%' },
  viewerClose: {
    position: 'absolute', top: 44, right: 20, width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center', zIndex: 1,
  },
});
