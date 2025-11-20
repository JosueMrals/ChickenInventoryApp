import { StyleSheet } from 'react-native';

export default StyleSheet.create({
  overlay: { flex:1, justifyContent:'flex-end', backgroundColor:'rgba(0,0,0,0.4)' },
  container: { backgroundColor:'#fff', padding:16, borderTopLeftRadius:12, borderTopRightRadius:12 },
  title: { fontSize:16, fontWeight:'800', marginBottom:10 },
  types: { flexDirection:'row', justifyContent:'space-between', marginBottom:12 },
  typeBtn: { flex:1, padding:10, marginHorizontal:4, borderRadius:8, backgroundColor:'#F1F3F8', alignItems:'center' },
  typeActive: { backgroundColor:'#007AFF' },
  typeText: { color:'#333' },
  typeActiveText: { color:'#fff', fontWeight:'700' },
  input: { backgroundColor:'#F6F8FB', padding:12, borderRadius:8, marginBottom:12 },
  actions: { flexDirection:'row', justifyContent:'space-between' },
  cancelBtn: { padding:12, borderRadius:8, backgroundColor:'#F6F6F6', flex:1, marginRight:8, alignItems:'center' },
  applyBtn: { padding:12, borderRadius:8, backgroundColor:'#007AFF', flex:1, marginLeft:8, alignItems:'center' },
  cancelText: { color:'#333', fontWeight:'700' },
  applyText: { color:'#fff', fontWeight:'700' }
});
