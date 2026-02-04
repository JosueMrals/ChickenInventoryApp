import React, { useState, useContext, useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform
} from "react-native";
import Icon from "react-native-vector-icons/Ionicons";
import styles from "../quicksalesNew/styles/productEditStyles";
import NumericKeyboard from "../../components/common/NumericKeyboard";
import { PreSaleContext } from "./context/preSaleContext";
import { calcPriceForProduct } from "../sales/hooks/useSalePricing";

export default function ProductEditScreen({ navigation, route }) {
  const { item, onUpdate, onRemove } = route.params;
  const { customer } = useContext(PreSaleContext);

  const [quantity, setQuantity] = useState(String(item.quantity));
  const [unitPrice, setUnitPrice] = useState(String(item.unitPrice));
  const [discount, setDiscount] = useState(String(item.discount));
  
  // Ref to prevent overwriting custom price on initial load
  const firstRun = useRef(true);

  // Recalculate price when quantity changes
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }

    const qty = Number(quantity);
    if (!isNaN(qty) && qty > 0) {
      const { priceToUse } = calcPriceForProduct({
        product: item.product,
        qty: qty,
        customer: customer
      });
      setUnitPrice(String(priceToUse));
    }
  }, [quantity, customer, item.product]);

  const save = () => {
    const qty = Number(quantity);
    const price = Number(unitPrice);
    const disc = Number(discount);

    if (qty <= 0 || isNaN(qty)) {
      return Alert.alert("Cantidad inválida", "Debe ser mayor a 0.");
    }

    if (price < 0 || isNaN(price)) {
      return Alert.alert("Precio inválido", "El precio no puede ser negativo.");
    }

    onUpdate({
      quantity: qty,
      unitPrice: price,
      discount: disc,
    });

    navigation.goBack();
  };

  const remove = () => {
    Alert.alert("Eliminar", "¿Eliminar este producto del carrito?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Eliminar", style: "destructive", onPress: () => {
          onRemove();
          navigation.goBack();
        }
      }
    ]);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1, backgroundColor: "#fff" }}
      keyboardVerticalOffset={Platform.OS === "ios" ? 100 : 0}
    >
      <View style={styles.container}>

        {/* HEADER */}
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Icon name="chevron-back" size={26} color="#111" />
          </TouchableOpacity>

          <Text style={styles.headerTitle}>{item.product.name}</Text>

          <TouchableOpacity onPress={remove}>
            <Icon name="trash-outline" size={24} color="#FF3B30" />
          </TouchableOpacity>
        </View>

        <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingBottom: 100 }}
            keyboardShouldPersistTaps="handled"
        >

          {/* CANTIDAD */}
          <Text style={styles.label}>Cantidad</Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            value={quantity}
            onChangeText={setQuantity}
          />

          {/* PRECIO UNITARIO */}
          <Text style={styles.label}>Precio Unitario</Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            value={unitPrice}
            onChangeText={setUnitPrice}
          />

          {/* DESCUENTO INDIVIDUAL */}
          <Text style={styles.label}>Descuento</Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            value={discount}
            onChangeText={setDiscount}
          />
        </ScrollView>

        {/* GUARDAR */}
        <TouchableOpacity style={styles.saveBtn} onPress={save}>
          <Text style={styles.saveText}>Guardar Cambios</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
