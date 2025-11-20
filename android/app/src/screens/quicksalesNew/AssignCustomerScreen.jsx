import React, { useState, useEffect, useContext } from "react";
import { View, Text, FlatList, TextInput, TouchableOpacity } from "react-native";
import firestore from "@react-native-firebase/firestore";
import styles from "./styles/assignCustomerStyles";
import { QuickSaleContext } from "./context/quickSaleContext";
import Icon from "react-native-vector-icons/Ionicons";


export default function AssignCustomerScreen({ navigation }) {
  const { setCustomer } = useContext(QuickSaleContext);
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const unsub = firestore()
      .collection("customers")
      .orderBy("firstName", "asc")
      .onSnapshot((snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setCustomers(list);
      });

    return unsub;
  }, []);

  const filtered = customers.filter((c) =>
    `${c.firstName} ${c.lastName}`.toLowerCase().includes(search.toLowerCase())
  );

  const selectCustomer = (c) => {
    setCustomer(c);
    navigation.goBack();
  };

  return (
    <View style={styles.container}>
        <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
        <Icon name="chevron-back" size={26} color="#111" />
      </TouchableOpacity>

      <Text style={styles.title}>Asignar Cliente</Text>
      </View>

      <TextInput
        placeholder="Buscar cliente..."
        style={styles.search}
        value={search}
        onChangeText={setSearch}
      />

      <FlatList
        data={filtered}
        keyExtractor={(i) => i.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => selectCustomer(item)}
          >
            <Text style={styles.name}>
              {item.firstName} {item.lastName}
            </Text>
            <Text style={styles.phone}>{item.phone}</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}
