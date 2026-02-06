import React, { useState } from "react";
import { View, Text, TouchableOpacity, Alert, SafeAreaView, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import NumericKeyboard from "../../components/common/NumericKeyboard";
import styles from "../quicksalesNew/styles/productQuantityStyles";
import globalStyles from "../../styles/globalStyles";
import Icon from "react-native-vector-icons/Ionicons";

export default function ProductQuantityScreen({ navigation, route }) {
  const { product, onConfirm } = route.params;

  const [qty, setQty] = useState("");

  const saveQuantity = () => {
    const n = Number(qty);

    if (!qty || isNaN(n) || n <= 0) {
      Alert.alert("Cantidad inválida", "Ingresa una cantidad mayor a 0.");
      return;
    }

    onConfirm(n);
    navigation.goBack();
  };

  const clearQty = () => setQty("");

  const renderInfoCarrusel = () => {
    const wholesale = product.wholesalePrices || [];
    const bonuses = (product.bonuses && Array.isArray(product.bonuses))
      ? product.bonuses
      : (product.bonus && product.bonus.enabled ? [product.bonus] : []);
    const activeBonuses = bonuses.filter(b => b.enabled && Number(b.threshold) > 0);

    if (wholesale.length === 0 && activeBonuses.length === 0) return null;

    return (
      <View style={{ width: '100%', marginBottom: 8 }}>
        {wholesale.length > 0 && (
          <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 10, alignItems: 'center' }}
              keyboardShouldPersistTaps="handled"
              style={{ marginBottom: activeBonuses.length > 0 ? 6 : 0, maxHeight: 40 }}
          >
            {wholesale.map((wp, i) => (
               <View key={`ws-${i}`} style={{
                   marginRight: 8, paddingHorizontal: 10, paddingVertical: 6,
                   backgroundColor: '#FFF8E1', borderRadius: 20, borderWidth: 1, borderColor: '#FFC107',
                   flexDirection: 'row', alignItems: 'center'
               }}>
                  <Icon name="pricetag" size={12} color="#F57F17" style={{marginRight: 4}} />
                  <Text style={{ fontSize: 11, color: '#F57F17', fontWeight: 'bold' }}>
                      Min {wp.quantity}: <Text style={{color: '#333'}}>${Number(wp.price).toFixed(2)}</Text>
                  </Text>
               </View>
            ))}
          </ScrollView>
        )}

        {activeBonuses.length > 0 && (
          <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 10, alignItems: 'center' }}
              keyboardShouldPersistTaps="handled"
              style={{ maxHeight: 40 }}
          >
            {activeBonuses.map((b, i) => (
               <View key={`b-${i}`} style={{
                   marginRight: 8, paddingHorizontal: 10, paddingVertical: 6,
                   backgroundColor: '#E3F2FD', borderRadius: 20, borderWidth: 1, borderColor: '#2196F3',
                   flexDirection: 'row', alignItems: 'center'
               }}>
                  <Icon name="gift" size={12} color="#1565C0" style={{marginRight: 4}} />
                  <Text style={{ fontSize: 11, color: '#0D47A1' }}>
                      {b.threshold} <Icon name="arrow-forward" size={10}/> {b.bonusQuantity} Gratis
                  </Text>
               </View>
            ))}
          </ScrollView>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff', paddingBottom: 20 }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={globalStyles.container}>

          {/* HEADER */}
          <View style={globalStyles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <Icon name="arrow-back" size={26} color="#fff" />
            </TouchableOpacity>

            <Text style={globalStyles.title}>{product.name}</Text>

          </View>

          <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
            {/* CONTENEDOR */}
            <View style={styles.inputContainer}>
              <Text style={styles.quantityLabel}>Cantidad:</Text>

              <View style={styles.quantityBox}>
                <Text style={styles.quantityText}>{qty || "0"}</Text>

              {/* BOTÓN BORRAR */}
              <TouchableOpacity onPress={clearQty} style={styles.quantityDelete}>
                <Icon name="close" size={20} color="#333" />
              </TouchableOpacity>
              </View>
            </View>

            {/* Renderizado original vertical eliminado en favor del carrusel en el teclado */}

          </ScrollView>

          {/* TECLADO NUMÉRICO CON INFO */}
          <NumericKeyboard
            value={qty}
            onChange={setQty}
            onSubmit={saveQuantity}
            infoComponent={renderInfoCarrusel()}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
