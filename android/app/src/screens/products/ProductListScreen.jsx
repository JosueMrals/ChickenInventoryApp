import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ActivityIndicator
} from "react-native";
import { useNavigation } from "@react-navigation/native";

// Hooks
import useProducts from "./hooks/useProducts";

// Components
import ProductCard from "./components/ProductCard";
import ProductFormModal from "./components/ProductForm/ProductFormModal"; // index.js from modular form
import ProductSearchBar from "./components/ProductSearchBar";
import ScannerModal from "./components/ScannerModal";

// Services
import { getProductByBarcode } from "./services/productService";

// Styles
import styles from "./styles/productsStyles";

export default function ProductListScreen({ route }) {
  const { role: paramRole, user: paramUser } = route?.params || {};
  const role = paramRole || "user";
  const navigation = useNavigation();

  const { products, loading, refresh } = useProducts();

  // UI state
  const [search, setSearch] = useState("");
  const [modalVisible, setModalVisible] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [scannerVisible, setScannerVisible] = useState(false);

  // Open new product form
  const openNewProduct = () => {
    setEditingProduct(null);
    setModalVisible(true);
  };

  // Edit product
  const openEditProduct = (product) => {
    setEditingProduct(product);
    setModalVisible(true);
  };

  // Search logic
  const filteredProducts = useMemo(() => {
    const s = typeof search === "string" ? search.trim() : "";
    if (!s) return products;

    const q = s.toLowerCase();

    return products.filter((p) =>
      p.name?.toLowerCase().includes(q) ||
      p.description?.toLowerCase().includes(q) ||
      p.barcode?.toLowerCase() === q ||
      p.barcode?.toLowerCase().includes(q)
    );
  }, [products, search]);

  // Scan button
  const handleOpenScanner = () => {
    setScannerVisible(true);
  };

  // When a barcode is scanned
  const handleScanned = async (code) => {
    setScannerVisible(false);

    const barcode = code.trim();
    const foundProduct = await getProductByBarcode(barcode);

    if (foundProduct) {
      setEditingProduct(foundProduct);
    } else {
      setEditingProduct({ barcode }); // Pre-fill for new product
    }

    setModalVisible(true);
  };

  return (
    <View style={styles.container}>

      {/* HEADER */}
      <View style={styles.header}>
        <Text style={styles.title}>Inventario Avanzado</Text>

        <View style={{ flexDirection: "row", gap: 8 }}>

          <TouchableOpacity
            style={styles.headerBtn}
            onPress={handleOpenScanner}
          >
            <Text style={styles.headerBtnText}>📷</Text>
          </TouchableOpacity>

          {role === "admin" && (
            <TouchableOpacity
              style={styles.headerBtn}
              onPress={openNewProduct}
            >
              <Text style={styles.headerBtnText}>+</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* BUSCADOR */}
      <ProductSearchBar search={search} setSearch={setSearch} />

      {/* LISTA */}
      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      ) : filteredProducts.length === 0 ? (
        <Text style={styles.emptyText}>No hay productos para mostrar.</Text>
      ) : (
        <FlatList
          data={filteredProducts}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <ProductCard
              product={item}
              role={role}
              onEdit={() => openEditProduct(item)}
            />
          )}
        />
      )}

      {/* FORMULARIO MODULAR */}
      <ProductFormModal
        visible={modalVisible}
        product={editingProduct}
        role={role}
        onClose={() => {
          setModalVisible(false);
          setEditingProduct(null);
          refresh();
        }}
      />

      {/* SCANNER MLKIT */}
      <ScannerModal
        visible={scannerVisible}
        onClose={() => setScannerVisible(false)}
        onScanned={handleScanned}
      />
    </View>
  );
}
