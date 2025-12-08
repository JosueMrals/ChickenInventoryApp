import React, { useState } from "react";
import { View, Text, TouchableOpacity, Alert, SafeAreaView, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import NumericKeyboard from "../../components/common/NumericKeyboard";
import styles from "./styles/productQuantityStyles";
import Icon from "react-native-vector-icons/Ionicons";

export default function ProductQuantityScreen({ navigation, route }) {
  const { product, onConfirm } = route.params;

  const [qty, setQty] = useState(""); // ← inicia VACÍO

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

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.container}>

          {/* HEADER */}
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <Icon name="arrow-back" size={26} color="#333" />
            </TouchableOpacity>

            <Text style={styles.headerTitle}>{product.name}</Text>

            <TouchableOpacity onPress={clearQty}>
              <Icon name="close-circle" size={24} color="#FF3B30" />
            </TouchableOpacity>
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

              {/* ELIMINAR PRODUCTO */}
              <TouchableOpacity
                style={styles.removeProductButton}
                onPress={() => {
                  onConfirm(0);
                  navigation.goBack();
                }}
              >
                <Text style={styles.removeProductText}>Eliminar producto</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>

          {/* TECLADO NUMÉRICO */}
          {/* Este teclado no es nativo, es un componente custom. No activa el teclado del sistema.
              Por lo tanto, no debería haber problema de solapamiento con el teclado del sistema,
              a menos que se use un TextInput oculto.
              Pero el componente parece usar botones.
              Si es custom, KeyboardAvoidingView no hace nada porque no hay teclado de sistema.
              Pero el usuario dijo "al usar el teclado en el telefono".
              Si ProductQuantityScreen usa un custom keyboard, el usuario se refiere a las pantallas donde SÍ hay inputs de texto.
              ProductQuantityScreen NO tiene TextInput visible.
              Sin embargo, lo dejo adaptado por si acaso.
           */}
          <NumericKeyboard value={qty} onChange={setQty} onSubmit={saveQuantity} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
