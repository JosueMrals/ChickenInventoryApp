import React from 'react';
import { View, TextInput, StyleSheet } from 'react-native';


export default function ProductSearch({ value, onChange }) {
    return (
        <View style={styles.container}>
            <TextInput
                placeholder="Buscar por nombre o código"
                value={value}
                onChangeText={onChange}
                style={styles.input}
                autoCapitalize="none"
            />
        </View>
        );
    }


const styles = StyleSheet.create({
    container: { padding: 8 },
    input: {
        backgroundColor: '#fff',
        padding: 10,
        borderRadius: 8,
        fontSize: 16 },
});