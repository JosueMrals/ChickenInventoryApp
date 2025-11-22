import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import styles from "../styles/productCardStyles";

export default function ProductCard({ product, role, onEdit }) {
  const isAdmin = role === "admin";

  return (
    <TouchableOpacity onPress={role === "admin" ? onEdit : undefined} style={[styles.card, role !== "admin" && { opacity: 0.8 }]}>
      <Text style={styles.name}>{product.name}</Text>
      <Text style={styles.description}>{product.description}</Text>

      <Text style={styles.code}>Código: {product.barcode}</Text>

      {isAdmin && (
          <Text style={styles.priceBuy}>
            Costo: ${product.purchasePrice?.toFixed(2) || "0.00"}
          </Text>
      )}


      <Text style={styles.priceSale}>
        Precio: ${product.salePrice?.toFixed(2) || "0.00"}
      </Text>

      {isAdmin && (
        <Text style={styles.stock}>Stock: {product.stock}</Text>
      )}

    </TouchableOpacity>
  );
}
