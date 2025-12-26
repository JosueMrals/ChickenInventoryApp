import React, { useRef, useState } from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  View,
  ActivityIndicator,
  Alert
} from 'react-native';
import { useNavigation } from '@react-navigation/native';

export default function CreateAddButton({
	screenName,
	visibleFor = [],
	userType = 'admin',
	label = '+',
	color = '#007AFF',
	size = 60
	}) {

	const navigation = useNavigation();

	const isVisible =
        visibleFor.length === 0 || visibleFor.includes(userType);

    if (!isVisible) return null;

	const handlePress = () => {
		navigation.navigate(screenName);
	}

	return (
		<TouchableOpacity
			onPress={handlePress}
			style={[
				styles.button,
				{
					backgroundColor: color,
					width: size,
					height: size,
					borderRadius: size / 2,
				}
			]}
		>
			<Text style={[styles.buttonText, { fontSize: size / 3 }]}>{label}</Text>
		</TouchableOpacity>
		);
}

const styles = StyleSheet.create({
  button: {
    position: 'absolute',
    bottom: 30,
    right: 20,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6
  },
  buttonText: {
    color: '#fff',
    fontSize: 30,
    fontWeight: '700'
  }
});
