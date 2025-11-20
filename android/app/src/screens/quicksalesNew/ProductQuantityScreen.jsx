import React, { useState } from "react";
import { View, Text, TouchableOpacity, Alert } from "react-native";
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

      {/* TECLADO NUMÉRICO */}
      <NumericKeyboard value={qty} onChange={setQty} onSubmit={saveQuantity} />
    </View>
  );
}


// export default function ProductQuantityScreen({ navigation, route }) {
//   const { product, onConfirm } = route.params;
//   const [quantity, setQuantity] = useState("1");
//
//   const validateQuantity = () => {
//     const q = Number(quantity);
//
//     if (!quantity || quantity === "" || quantity === "." || q <= 0 || isNaN(q)) {
//       Alert.alert("Cantidad inválida", "Ingresa una cantidad mayor a 0.");
//       return false;
//     }
//     return true;
//   };
//
//   const save = () => {
//     if (!validateQuantity()) return;
//     onConfirm(Number(quantity));
//     navigation.goBack();
//   };
//
//   const clearQuantity = () => setQuantity("0");
//
//   return (
//     <View style={styles.container}>
//
//       {/* HEADER */}
//       <View style={styles.headerRow}>
//         <TouchableOpacity onPress={() => navigation.goBack()}>
//           <Icon name="chevron-back" size={26} color="#111" />
//         </TouchableOpacity>
//
//         <Text style={styles.headerTitle}>{product.name}</Text>
//
//         <TouchableOpacity>
//           <Text style={styles.complimentary}>Give complimentary</Text>
//         </TouchableOpacity>
//       </View>
//
//       <Text style={styles.quantityLabel}>Cantidad:</Text>
//
//       <View style={styles.quantityBox}>
//         <Text style={styles.quantityText}>{quantity}</Text>
//
//         <TouchableOpacity style={styles.quantityDelete} onPress={clearQuantity}>
//           <Icon name="close-outline" size={24} color="#555" />
//         </TouchableOpacity>
//       </View>
//
//       <TouchableOpacity onPress={() => navigation.goBack()}>
//         <Text style={styles.removeText}>Remove product</Text>
//       </TouchableOpacity>
//
//       <View style={{ flex: 1 }} />
//
//       <NumericKeyboard value={quantity} onChange={setQuantity} onSubmit={save} />
//
//     </View>
//   );
// }
