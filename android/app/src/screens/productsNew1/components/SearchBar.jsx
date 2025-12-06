import React from 'react';
import { View, TextInput, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';


export default function SearchBar({ onChangeText, placeholder = 'Buscar', onClear }) {
	return (
		<View style={{ flexDirection: 'row', padding: 8, alignItems: 'center' }}>
			<Icon name="search" size={20} />
				<TextInput
					placeholder={placeholder}
					style={{ flex: 1, marginLeft: 8 }}
					onChangeText={onChangeText}
				/>
				<TouchableOpacity onPress={onClear} style={{ padding: 8 }}>
			<Icon name="close" size={18} />
			</TouchableOpacity>
		</View>
	);
}