import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';


export default function ProductItem({ product, onEdit, onAddStock }) {
    return (
        <View style={styles.row}>
            <View style={{ flex: 1 }}>
                <Text style={styles.title}>{product.name}</Text>
                <Text style={styles.subtitle}>{product.barcode || '—'}</Text>
                <Text>{product.stock} unidades</Text>
            </View>
            <View style={styles.actions}>
                <TouchableOpacity onPress={() => onAddStock(product)} style={styles.btnSmall}>
                <Text>+ Stock</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => onEdit(product)} style={styles.btnSmall}>
                <Text>Editar</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}


const styles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        padding: 12,
        borderBottomWidth: 1,
        borderColor: '#eee',
        alignItems: 'center'
    },
    title: {
        fontWeight: '600'
    },
    subtitle: {
        color: '#666'
    },
    actions: {
        flexDirection: 'row'
    },
    btnSmall: {
        marginLeft: 8,
        padding: 8,
        backgroundColor: '#f5f5f5',
        borderRadius: 6
    },
});