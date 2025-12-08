import React, { useContext, useState, useEffect } from "react";
import { View, Text, TextInput, FlatList, TouchableOpacity, ActivityIndicator, SafeAreaView, KeyboardAvoidingView, Platform } from "react-native";
import Icon from "react-native-vector-icons/Ionicons";
import firestore from "@react-native-firebase/firestore";
import styles from "./styles/assignCustomerStyles";
import { QuickSaleContext } from "./context/quickSaleContext";

export default function AssignCustomerScreen({ navigation }) {
  const { setCustomer } = useContext(QuickSaleContext);
  const [search, setSearch] = useState("");
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = firestore().collection("customers").orderBy("firstName", "asc").onSnapshot(snap => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setCustomers(list);
      setLoading(false);
    });
    return unsub;
  }, []);

  const filtered = customers.filter(c => {
    const full = `${c.firstName} ${c.lastName}`.toLowerCase();
    return full.includes(search.toLowerCase());
  });

  const selectCustomer = (customer) => {
    setCustomer(customer);
    navigation.goBack();
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <Icon name="arrow-back" size={26} color="#333" />
            </TouchableOpacity>
            <Text style={styles.title}>Seleccionar Cliente</Text>
            <View style={{ width: 26 }} />
          </View>

          <View style={styles.searchBox}>
            <Icon name="search" size={20} color="#999" style={{ marginRight: 8 }} />
            <TextInput
              style={styles.input}
              placeholder="Buscar cliente..."
              value={search}
              onChangeText={setSearch}
            />
          </View>

          {loading ? (
            <ActivityIndicator size="large" style={{ marginTop: 20 }} />
          ) : (
            <FlatList
              data={filtered}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ paddingBottom: 20 }}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.item} onPress={() => selectCustomer(item)}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{item.firstName[0]}</Text>
                  </View>
                  <View>
                    <Text style={styles.name}>{item.firstName} {item.lastName}</Text>
                    {item.discount > 0 && (
                      <Text style={styles.discount}>Descuento: {item.discount}%</Text>
                    )}
                  </View>
                </TouchableOpacity>
              )}
            />
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
