import { StyleSheet } from 'react-native';

export default StyleSheet.create({
  card: { flexDirection:'row', backgroundColor:'#fff', marginVertical:8, padding:12, borderRadius:12, elevation:3 },
  left: { flex:1 },
  name: { fontWeight:'700', fontSize:15, color:'#111' },
  sku: { color:'#888', marginTop:4 },
  right: { width:140, alignItems:'flex-end', justifyContent:'space-between' },
  unit: { color:'#666' },
  total: { fontWeight:'700', marginTop:6 },
  actions: { flexDirection:'row', marginTop:8 },
  actionBtn: { alignItems:'center', marginLeft:8 },
  actionText: { fontSize:12, color:'#333', marginTop:4 }
});
