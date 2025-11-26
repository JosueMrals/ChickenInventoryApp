import React, { useEffect, useState } from "react";
import { View, Text, FlatList, ActivityIndicator } from "react-native";
import firestore from "@react-native-firebase/firestore";
import styles from "../styles/clientsPanelStyles";

export default function ClientsPanelPRO({ dateFrom, dateTo }) {

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  // 🔥 Obtener clientes top desde el servicio
  const getBestClients = async () => {
    try {
      // Obtener los top desde el servicio V4.1
      const snap = await firestore()
        .collection("sales")
        .orderBy("createdAt")
        .where("createdAt", ">=", dateFrom ? firestore.Timestamp.fromDate(dateFrom) : new Date(0))
        .where("createdAt", "<=", dateTo ? firestore.Timestamp.fromDate(dateTo) : new Date())
        .get();

      const totals = {};

      snap.forEach(doc => {
        const s = doc.data();
        if (s.customerId) {
          totals[s.customerId] = (totals[s.customerId] || 0) + Number(s.total || 0);
        }
      });

      const list = Object.entries(totals)
        .map(([customerId, total]) => ({ customerId, total }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 20);

      return list;

    } catch (e) {
      console.log("ERROR getBestClients:", e);
      return [];
    }
  };

  // 🔥 Convertir customerId → Nombre real
  const injectCustomerNames = async (list) => {
    if (!list || list.length === 0) return [];

    const ids = [...new Set(list.map(c => c.customerId))];

    const customerDocs = await firestore()
      .collection("customers")
      .where(firestore.FieldPath.documentId(), "in", ids)
      .get();

    const namesMap = {};
    customerDocs.forEach(d => {
      namesMap[d.id] = d.data().name || "Cliente sin nombre";
    });

    // Reemplazar ID → nombre real
    return list.map(c => ({
      ...c,
      name: namesMap[c.customerId] || "Cliente desconocido"
    }));
  };

  // 🔥 Ejecutar todo
  useEffect(() => {
    async function load() {
      setLoading(true);

      const best = await getBestClients();
      const withNames = await injectCustomerNames(best);

      setData(withNames);
      setLoading(false);
    }

    load();
  }, [dateFrom, dateTo]);


  // ========= UI =========
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (!data.length) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>Sin datos de clientes</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={data}
        keyExtractor={(item) => item.customerId}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{item.name}</Text>
            <Text style={styles.cardAmount}>${item.total.toFixed(2)}</Text>
          </View>
        )}
      />
    </View>
  );
}
