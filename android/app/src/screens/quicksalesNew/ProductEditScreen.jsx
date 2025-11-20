import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  TextInput,
  ScrollView,
} from "react-native";
import Icon from "react-native-vector-icons/Ionicons";
import styles from "./styles/productEditStyles";
import NumericKeyboard from "../../components/common/NumericKeyboard";

export default function ProductEditScreen({ navigation, route }) {
  const { item, onUpdate, onRemove } = route.params;

  const [quantity, setQuantity] = useState(String(item.quantity));
  const [unitPrice, setUnitPrice] = useState(String(item.unitPrice));
  const [discount, setDiscount] = useState(String(item.discount));

  const save = () => {
    const qty = Number(quantity);
    const price = Number(unitPrice);
    const disc = Number(discount);

    if (qty <= 0 || isNaN(qty)) {
      return Alert.alert("Cantidad inválida", "Debe ser mayor a 0.");
    }

    if (price <= 0 || isNaN(price)) {
      return Alert.alert("Precio inválido", "Debe ser mayor a 0.");
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

      <ScrollView style={{ flex: 1 }}>

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

      {/* NUMERIC KEYBOARD */}
      <NumericKeyboard
        value={quantity}
        onChange={setQuantity}
        onSubmit={save}
      />

      {/* GUARDAR */}
      <TouchableOpacity style={styles.saveBtn} onPress={save}>
        <Text style={styles.saveText}>Guardar Cambios</Text>
      </TouchableOpacity>
    </View>
  );
}

