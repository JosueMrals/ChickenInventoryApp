import React from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';

export default function ProductCard({ product, onEdit, onDelete }) {
  return (
    <View style={{
      backgroundColor:'#f8f9fb',
      padding:12,
      borderRadius:12,
      flexDirection:'row',
      alignItems:'center',
      justifyContent:'space-between',
      shadowColor:'#000', shadowOpacity:0.05, shadowRadius:6, elevation:2
    }}>
      <View style={{flex:1}}>
        <Text style={{fontSize:16, fontWeight:'700'}}>{product.name}</Text>
        <Text style={{color:'#666', marginTop:4}}>{product.description ?? '—'}</Text>
        <Text style={{marginTop:6, fontWeight:'600'}}>C$ {Number(product.price || 0).toFixed(2)}</Text>
      </View>

      <View style={{marginLeft:12, alignItems:'flex-end'}}>
        <TouchableOpacity disabled={!onEdit} onPress={onEdit} ...>
          <Text style={{color:onEdit?'#0066FF':'#aaa'}}>Editar</Text>
        </TouchableOpacity>
        <TouchableOpacity disabled={!onDelete} onPress={onDelete} ...>
          <Text style={{color:onDelete?'#FF3B30':'#aaa'}}>Eliminar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
