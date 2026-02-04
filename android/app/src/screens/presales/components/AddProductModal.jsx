import React, { useMemo, useState, useEffect } from "react";
import { View, Text, TouchableOpacity, FlatList, ActivityIndicator,
	Modal, StyleSheet } from "react-native";
import Icon from "react-native-vector-icons/Ionicons";
import SearchBar from "../../../components/SearchBar";
import firestore from "@react-native-firebase/firestore";

const AddProductModal = ({ visible, onClose, onAddProduct, cart }) => {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState("");
    
    const cartProductIds = useMemo(() => new Set(cart.map(item => item.id)), [cart]);

    useEffect(() => {
        if (visible) {
            setLoading(true);
            const unsubscribe = firestore()
                .collection("products")
                .orderBy("name", "asc")
                .onSnapshot(snapshot => {
                    const productList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                    setProducts(productList);
                    setLoading(false);
                });
            return () => unsubscribe();
        }
    }, [visible]);

    const filteredProducts = useMemo(() =>
        products.filter(p => p.name.toLowerCase().includes(search.toLowerCase())),
        [products, search]
    );

    const renderProductItem = ({ item }) => {
        const isSelected = cartProductIds.has(item.id);
        return (
            <TouchableOpacity 
                style={[modalStyles.productItem, isSelected && modalStyles.selectedProductItem]} 
                onPress={() => onAddProduct(item)}
            >
                <Text style={[modalStyles.productName,
					isSelected && modalStyles.selectedProductName]}>{item.name}</Text>
                {isSelected && <Icon name="checkmark-circle" size={24} color="#28A745" />}
            </TouchableOpacity>
        );
    };

    return (
        <Modal
            animationType="slide"
            transparent={true}
            visible={visible}
            onRequestClose={onClose}
        >
            <View style={modalStyles.centeredView}>
                <View style={modalStyles.modalView}>
                    <View style={modalStyles.searchBarContainer}>
                        <SearchBar
                            value={search}
                            onChangeText={setSearch}
                            placeholder="Buscar producto..."
                        />
                    </View>
                    {loading ? <ActivityIndicator style={{ marginTop: 20 }} /> : (
                        <FlatList
                            style={modalStyles.list}
                            data={filteredProducts}
                            keyExtractor={(item) => item.id}
                            renderItem={renderProductItem}
                            ListEmptyComponent={<Text style={modalStyles.emptyText}>No se encontraron productos</Text>}
                        />
                    )}
                    <TouchableOpacity style={modalStyles.closeButton} onPress={onClose}>
                        <Text style={modalStyles.closeButtonText}>Cerrar</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
};

const modalStyles = StyleSheet.create({
    centeredView: { flex: 1, justifyContent: "center", alignItems: "center",
		backgroundColor: 'rgba(0,0,0,0.5)' }, modalView: { width: '90%', maxHeight: '80%',
		backgroundColor: "white", borderRadius: 20, padding: 20, alignItems: "center",
		shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25,
		shadowRadius: 4, elevation: 5 },
    searchBarContainer: { width: '100%', marginBottom: 10 },
    list: { width: '100%' },
    productItem: { flexDirection: 'row', justifyContent: 'space-between',
		alignItems: 'center', padding: 15, borderBottomWidth: 1, borderBottomColor: '#eee',
		width: '100%' },
    selectedProductItem: { backgroundColor: '#f0f0f0' },
    productName: { fontSize: 16, color: '#333' },
    selectedProductName: { color: '#999' },
    emptyText: { marginTop: 20, color: '#888', textAlign: 'center' },
    closeButton: { backgroundColor: "#2196F3", borderRadius: 10, padding: 12,
		elevation: 2, marginTop: 15, width: '100%' },
    closeButtonText: { color: "white", fontWeight: "bold", textAlign: "center" },
});

export default AddProductModal;
