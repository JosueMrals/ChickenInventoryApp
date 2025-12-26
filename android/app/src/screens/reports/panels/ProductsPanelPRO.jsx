import React, { useEffect, useState } from "react";
import { View, Text, FlatList, ActivityIndicator, Image } from "react-native";
import firestore, { Timestamp } from "@react-native-firebase/firestore";
import styles from "../styles/productsPanelStyles";

export default function ProductsPanelPRO({ dateFrom, dateTo }) {
  const [loading, setLoading] = useState(true);
  const [topProducts, setTopProducts] = useState([]);

  /*****************************************************
   * 🔥 1) EXTRAER PRODUCTOS MÁS VENDIDOS DEL HISTORIAL
   *****************************************************/
  const getTopProducts = async () => {
    try {
      let q = firestore().collection("sales").orderBy("createdAt");

      if (dateFrom) q = q.where("createdAt", ">=", Timestamp.fromDate(dateFrom));
      if (dateTo) q = q.where("createdAt", "<=", Timestamp.fromDate(dateTo));

      const snap = await q.get();
      const counter = {};

      snap.forEach((doc) => {
        const sale = doc.data();
        (sale.items || []).forEach((it) => {
          const productId = it.id; // ✔ TU ESTRUCTURA REAL
          const qty = Number(it.quantity ?? 0);
          const total = Number(it.total ?? 0);

          if (!productId) return;

          if (!counter[productId]) {
            counter[productId] = { productId, qty: 0, total: 0 };
          }

          counter[productId].qty += qty;
          counter[productId].total += total;
        });
      });

      return Object.values(counter).sort((a, b) => b.qty - a.qty).slice(0, 20);

    } catch (e) {
      console.log("ERROR getTopProducts:", e);
      return [];
    }
  };

  /*****************************************************
   * 🔥 2) CARGAR DETALLES REALES DE PRODUCTOS
   *****************************************************/
  const enrichProducts = async (list) => {
    if (!list || list.length === 0) return [];

    const ids = list.map((p) => p.productId);

    // Firestore límite de 10 por IN → dividimos en chunks
    const chunks = [];
    while (ids.length) chunks.push(ids.splice(0, 10));

    const fullMap = {};

    for (const ch of chunks) {
      const snap = await firestore()
        .collection("products")
        .where(firestore.FieldPath.documentId(), "in", ch)
        .get();

      snap.forEach((d) => {
        fullMap[d.id] = d.data();
      });
    }

    return list.map((p) => ({
      ...p,
      name: fullMap[p.productId]?.name || "Producto desconocido",
      image: fullMap[p.productId]?.image || null,
      unit: fullMap[p.productId]?.unit || null,
    }));
  };

  /*****************************************************
   * 🔥 3) CARGAR Y PROCESAR TODO
   *****************************************************/
  useEffect(() => {
    async function load() {
      setLoading(true);

      const raw = await getTopProducts();
      const enriched = await enrichProducts(raw);

      setTopProducts(enriched);
      setLoading(false);
    }

    load();
  }, [dateFrom, dateTo]);


  /*****************************************************
   * 🔥 4) UI — LOADING
   *****************************************************/
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  /*****************************************************
   * 🔥 5) SIN DATOS
   *****************************************************/
  if (!topProducts.length) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>Sin datos de productos</Text>
      </View>
    );
  }

  /*****************************************************
   * 🔥 6) LISTA FINAL
   *****************************************************/
  return (
    <View style={styles.container}>
      <FlatList
        data={topProducts}
        keyExtractor={(item) => item.productId}
        renderItem={({ item }) => (
          <View style={styles.card}>

            <View style={styles.infoBox}>
              <Text style={styles.productTitle}>{item.name}</Text>

              <Text style={styles.productStats}>
                Cantidad vendida: <Text style={styles.bold}>{item.qty}</Text>
              </Text>

              <Text style={styles.productStats}>
                Ingresos: <Text style={styles.bold}>${item.total.toFixed(2)}</Text>
              </Text>
            </View>

          </View>
        )}
      />
    </View>
  );
}
