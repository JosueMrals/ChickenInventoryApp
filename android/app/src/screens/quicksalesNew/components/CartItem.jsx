import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, TextInput } from "react-native";
import Icon from "react-native-vector-icons/Ionicons";
import styles from "../styles/cartItemStyles";

const formatCurrency = (value) => `C$${(Number(value) || 0).toFixed(2)}`;

export default function CartItem({ item, onUpdate, onDiscount, onRemove }) {
  const product = item.product || { name: 'Producto no disponible' };
  const quantity = Number(item.quantity) || 0;
  
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState(quantity.toString());

  useEffect(() => {
    if (!isEditing) {
      setInputValue(quantity.toString());
    }
  }, [quantity]);

  const handleUpdateQuantity = (newQuantity) => {
    if (item.isBonus) return;
    if (newQuantity <= 0) {
      onRemove();
      return;
    }
    if (onUpdate) {
      onUpdate({ quantity: newQuantity });
    }
  };

  const handleBlur = () => {
    setIsEditing(false);
    const newQuantity = parseInt(inputValue, 10);
    
    if (!isNaN(newQuantity) && newQuantity > 0) {
        if (newQuantity !== quantity) {
            handleUpdateQuantity(newQuantity);
        }
    } else {
        setInputValue(quantity.toString());
    }
  };

  const QuantityDisplay = () => {
    if (isEditing) {
        return (
            <TextInput
                style={styles.quantityInput}
                value={inputValue}
                onChangeText={setInputValue}
                keyboardType="number-pad"
                autoFocus={true}
                onBlur={handleBlur}
                onSubmitEditing={handleBlur}
                returnKeyType="done"
                textAlign="center"
            />
        );
    }

    return (
        <TouchableOpacity onPress={() => !item.isBonus && setIsEditing(true)}>
            <Text style={styles.quantityDisplay}>{quantity}</Text>
        </TouchableOpacity>
    );
  };
  
  const NormalItem = () => (
    <View style={styles.card}>
      <View style={styles.left}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>{product.name}</Text>
          <Text style={styles.totalText}>{formatCurrency(item.total)}</Text>
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.subtitle}>{quantity} x {formatCurrency(item.unitPrice)}</Text>
        </View>
        {item.isCategoryDiscountActive && item.categoryDiscountBadge ? (
          <Text style={{ fontSize: 11, color: '#1D4ED8', fontWeight: '700' }}>{item.categoryDiscountBadge}</Text>
        ) : null}
        {(item.discount > 0) && <Text style={styles.discountText}>Descuento: -{formatCurrency(item.discount)}</Text>}
      </View>
      <View style={styles.actions}>
        <TouchableOpacity style={styles.btn} onPress={() => handleUpdateQuantity(quantity - 1)}>
          <Icon name="remove-circle-outline" size={24} color="#FF9500" />
        </TouchableOpacity>

        <QuantityDisplay />

        <TouchableOpacity style={styles.btn} onPress={() => handleUpdateQuantity(quantity + 1)}>
          <Icon name="add-circle-outline" size={24} color="#34C759" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.btn} onPress={onDiscount}>
            <Icon name="pricetag-outline" size={20} color="#34C759" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.btn} onPress={onRemove}>
            <Icon name="trash-outline" size={20} color="#FF3B30" />
        </TouchableOpacity>
      </View>
    </View>
  );

  const BonusItem = () => (
    <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#F0F8FF',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#BFE6FF',
        paddingVertical: 6,
        paddingHorizontal: 10,
        marginBottom: 8,
        marginLeft: 20,
        marginTop: -6,
        borderLeftWidth: 4,
        borderLeftColor: '#007AFF',
    }}>
      <View style={{flex: 1, marginRight: 8}}>
        <Text style={{fontSize: 13, color: '#333', fontWeight: '500'}}>{product.name}</Text>
{/*         {Number(item?.bonusRuleIndex || 0) > 0 ? ( */}
{/*           <Text style={{ fontSize: 11, color: '#1D4ED8', marginTop: 2, fontWeight: '700' }}> */}
{/*             Regla #{Number(item.bonusRuleIndex)} */}
{/*           </Text> */}
{/*         ) : null} */}
      </View>
      <View style={{alignItems: 'flex-end', justifyContent: 'center'}}>
         <Text style={{fontSize: 14, color: '#007AFF', fontWeight: 'bold'}}>x{quantity}</Text>
      </View>
    </View>
  );

  return item.isBonus ? <BonusItem /> : <NormalItem />;
}
