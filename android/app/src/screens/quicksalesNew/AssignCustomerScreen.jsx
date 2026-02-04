import React, { useContext, useState, useEffect } from "react";
import { View, Text, TextInput, FlatList, TouchableOpacity, ActivityIndicator, SafeAreaView, KeyboardAvoidingView, Platform, StyleSheet } from "react-native";
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
    <SafeAreaView style={{ flex: 1, backgroundColor: '#007AFF' }}>
      <View style={{ flex: 1, backgroundColor: '#F6F8FB' }}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <Icon name="chevron-back" size={28} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.title}>Seleccionar Cliente</Text>
            <View style={{ width: 28 }} />
          </View>

          {/* Search */}
          <View style={{ paddingHorizontal: 16, marginBottom: 10 }}>
            <View style={{
                flexDirection: 'row',
                backgroundColor: '#fff',
                borderRadius: 12,
                paddingHorizontal: 12,
                alignItems: 'center',
                height: 48,
                elevation: 4,
                shadowColor: '#000',
                shadowOpacity: 0.1,
                shadowRadius: 4,
                shadowOffset: { width: 0, height: 2 }
            }}>
                <Icon name="search" size={20} color="#999" style={{ marginRight: 8 }} />
                <TextInput
                  style={{ flex: 1, fontSize: 16, color: '#333' }}
                  placeholder="Buscar cliente..."
                  placeholderTextColor="#999"
                  value={search}
                  onChangeText={setSearch}
                />
            </View>
          </View>

          {loading ? (
            <ActivityIndicator size="large" style={{ marginTop: 40 }} color="#007AFF" />
          ) : (
            <FlatList
              data={filtered}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ paddingBottom: 20, paddingTop: 4 }}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={
                  <View style={styles.emptyBox}>
                      <Icon name="people-outline" size={48} color="#ccc" />
                      <Text style={[styles.emptyText, { marginTop: 10 }]}>No se encontraron clientes</Text>
                  </View>
              }
              renderItem={({ item }) => (
                <TouchableOpacity
                    style={styles.card}
                    onPress={() => selectCustomer(item)}
                    activeOpacity={0.7}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <View style={{
                          width: 44,
                          height: 44,
                          borderRadius: 22,
                          backgroundColor: '#E3F2FD',
                          justifyContent: 'center',
                          alignItems: 'center',
                          marginRight: 12
                      }}>
                          <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#007AFF' }}>
                              {item.firstName ? item.firstName[0].toUpperCase() : '?'}
                          </Text>
                      </View>

                      <View style={{ flex: 1 }}>
                        <Text style={styles.name}>{item.firstName} {item.lastName}</Text>
                        {item.phone ? (
                             <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                                <Icon name="call-outline" size={14} color="#666" style={{ marginRight: 4 }} />
                                <Text style={{ color: '#666', fontSize: 13 }}>{item.phone}</Text>
                             </View>
                        ) : null}
                      </View>

                       {item.discount > 0 && (
                          <View style={{
                              backgroundColor: '#E8F5E9',
                              paddingHorizontal: 8,
                              paddingVertical: 4,
                              borderRadius: 6
                          }}>
                            <Text style={{ color: '#2E7D32', fontSize: 12, fontWeight: '700' }}>
                                -{item.discount}%
                            </Text>
                          </View>
                        )}
                  </View>
                </TouchableOpacity>
              )}
            />
          )}
        </KeyboardAvoidingView>
      </View>
    </SafeAreaView>
  );
}
