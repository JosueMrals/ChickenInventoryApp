import React, { useEffect, useState } from "react";
import { Modal, View, Text, TouchableOpacity, Alert } from "react-native";
import styles from "../../styles/productFormStyles";

import {
  createProduct,
  updateProduct,
  deleteProduct
} from "../../services/productService";

import ProductFormFields from "./ProductFormFields";
import ProductPricingSection from "./ProductPricingSection";
import ProductMeasureSection from "./ProductMeasureSection";
import ProductStockSection from "./ProductStockSection";

export default function ProductFormModal({ visible, onClose, product, role }) {
  const isAdmin = role === "admin";
  const isNew = !product?.id;

  // Estados principales
  const [name, setName] = useState("");
  const [barcode, setBarcode] = useState("");
  const [description, setDescription] = useState("");

  const [measureType, setMeasureType] = useState("unit");
  const [stock, setStock] = useState(0);

  // Precios
  const [purchasePrice, setPurchasePrice] = useState("");
  const [profitMargin, setProfitMargin] = useState("30");
  const [salePrice, setSalePrice] = useState("");
  const [autoSalePrice, setAutoSalePrice] = useState(true);

  // Cargar datos existentes
  useEffect(() => {
    if (product) {
      setName(product.name || "");
      setBarcode(product.barcode || "");
      setDescription(product.description || "");
      setPurchasePrice(product.purchasePrice ? String(product.purchasePrice) : "");
      setProfitMargin(product.profitMargin ? String(product.profitMargin) : "30");
      setSalePrice(product.salePrice ? String(product.salePrice) : "");
      setAutoSalePrice(
        product.autoSalePrice !== undefined ? product.autoSalePrice : true
      );
      setMeasureType(product.measureType || "unit");
      setStock(product.stock || 0);
    }
  }, [product]);

  // Cálculo automático
  useEffect(() => {
    if (autoSalePrice) {
      const c = parseFloat(purchasePrice);
      const m = parseFloat(profitMargin) / 100;

      if (!isNaN(c) && !isNaN(m) && m < 1) {
        const calc = (c / (1 - m)).toFixed(2);
        setSalePrice(calc);
      }
    }
  }, [purchasePrice, profitMargin, autoSalePrice]);

  // Guardar producto
  const handleSave = async () => {
    if (!name.trim()) return Alert.alert("Error", "El nombre es obligatorio.");

    const data = {
      name,
      barcode,
      description,
      purchasePrice: parseFloat(purchasePrice) || 0,
      profitMargin: parseFloat(profitMargin) || 0,
      salePrice: parseFloat(salePrice) || 0,
      autoSalePrice,
      measureType,
      stock,
      createdAt: product?.createdAt || new Date().toISOString(),
    };

    try {
      if (isNew) await createProduct(data);
      else await updateProduct(product.id, data);

      onClose();
    } catch (e) {
      console.log("Error saving:", e);
      Alert.alert("Error", "No se pudo guardar.");
    }
  };

  const handleDelete = () => {
    Alert.alert(
      "Eliminar",
      "¿Seguro que deseas eliminar este producto?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            await deleteProduct(product.id);
            onClose();
          },
        },
      ]
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.modal}>

          <Text style={styles.title}>
            {isNew ? "Nuevo Producto" : "Editar Producto"}
          </Text>

          {/* Datos principales */}
          <ProductFormFields
            isAdmin={isAdmin}
            name={name}
            setName={setName}
            barcode={barcode}
            setBarcode={setBarcode}
            description={description}
            setDescription={setDescription}
          />

          {/* Precios */}
          <ProductPricingSection
            isAdmin={isAdmin}
            purchasePrice={purchasePrice}
            setPurchasePrice={setPurchasePrice}
            profitMargin={profitMargin}
            setProfitMargin={setProfitMargin}
            salePrice={salePrice}
            setSalePrice={setSalePrice}
            autoSalePrice={autoSalePrice}
            setAutoSalePrice={setAutoSalePrice}
          />

          {/* Tipo de medida */}
          <ProductMeasureSection
            isAdmin={isAdmin}
            measureType={measureType}
            setMeasureType={setMeasureType}
          />

          {/* Stock e ingreso */}
          {!isNew && (
            <ProductStockSection
              isAdmin={isAdmin}
              stock={stock}
              setStock={setStock}
              product={product}
              onClose={onClose}
            />
          )}

          {/* Botones */}
          <View style={styles.btnRow}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelText}>Cancelar</Text>
            </TouchableOpacity>

            {isAdmin && (
              <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
                <Text style={styles.saveText}>Guardar</Text>
              </TouchableOpacity>
            )}
          {isAdmin && !isNew && (
            <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
              <Text style={styles.deleteText}>Eliminar</Text>
            </TouchableOpacity>
          )}
          </View>


        </View>
      </View>
    </Modal>
  );
}
