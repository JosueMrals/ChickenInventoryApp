import React from "react";
import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import Icon from "react-native-vector-icons/Ionicons";
import styles from "./styles/doneReceiptStyles";

export default function QuickSaleDoneScreen({ navigation, route }) {
  const { sale } = route.params;

  const paymentLabels = {
    cash: "Efectivo",
    card: "Tarjeta"
  };

  const readablePayment = paymentLabels[sale.paymentMethod] || "Pago";

  return (
    <View style={styles.container}>

      {/* HEADER */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Pago Listo</Text>
      </View>

      {/* RECIBO */}
      <ScrollView style={styles.receiptBox} showsVerticalScrollIndicator={false}>

        <Text style={styles.bigCheck}>✓</Text>
        <Text style={styles.successText}>Venta completada</Text>

        {/* DATOS GENERALES */}
        <View style={styles.section}>
          <Text style={styles.label}>Fecha:</Text>
          <Text style={styles.value}>
            {sale.date.toLocaleString()}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Cliente:</Text>
          <Text style={styles.value}>
            {sale.customer?.firstName
              ? `${sale.customer.firstName} ${sale.customer.lastName ?? ""}`
              : "Venta rápida"}
          </Text>
        </View>

        {/* LINEA SEPARADORA */}
        <View style={styles.separator} />

        {/* LISTA DE PRODUCTOS */}
        <Text style={styles.sectionTitle}>Productos</Text>

        {sale.items.map((item, index) => {
          const productName = item.product?.name ?? item.name ?? "Producto";
          const unit = item.unitPrice ?? item.price ?? 0;

          return (
            <View key={index} style={styles.itemRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemName}>{productName}</Text>
                <Text style={styles.itemDetails}>
                  {item.quantity} x C${unit.toFixed(2)}
                </Text>
              </View>

              <Text style={styles.itemTotal}>
                C${(unit * item.quantity).toFixed(2)}
              </Text>
            </View>
          );
        })}

        <View style={styles.separator} />

        {/* RESUMEN */}
        <View style={styles.summaryRow}>
          <Text style={styles.label}>Subtotal</Text>
          <Text style={styles.value}>C${sale.subtotal.toFixed(2)}</Text>
        </View>

        {sale.discount > 0 && (
          <View style={styles.summaryRow}>
            <Text style={styles.label}>Descuento</Text>
            <Text style={styles.discount}>-C${sale.discount.toFixed(2)}</Text>
          </View>
        )}

        {sale.tip > 0 && (
          <View style={styles.summaryRow}>
            <Text style={styles.label}>Propina</Text>
            <Text style={styles.value}>C${sale.tip.toFixed(2)}</Text>
          </View>
        )}

        <View style={styles.summaryRow}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>C${sale.total.toFixed(2)}</Text>
        </View>

        <View style={styles.summaryRow}>
          <Text style={styles.label}>Pagado</Text>
          <Text style={styles.value}>C${sale.amountPaid.toFixed(2)}</Text>
        </View>

        {sale.change > 0 && (
          <View style={styles.summaryRow}>
            <Text style={styles.label}>Cambio</Text>
            <Text style={styles.value}>C${sale.change.toFixed(2)}</Text>
          </View>
        )}

        <View style={styles.summaryRow}>
          <Text style={styles.label}>Método de pago</Text>
          <Text style={styles.value}>{readablePayment}</Text>
        </View>

        <View style={styles.separator} />

        <Text style={styles.footerText}>¡Gracias por su compra!</Text>
      </ScrollView>

      {/* BOTÓNES INFERIORES */}
      <TouchableOpacity style={styles.shareButton}>
        <Icon name="print-outline" size={20} color="#fff" />
        <Text style={styles.shareText}>Imprimir / Compartir ticket</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.newSaleButton}
        onPress={() => navigation.replace("QuickSaleProducts")}
      >
        <Text style={styles.newSaleText}>Empezar nueva venta</Text>
      </TouchableOpacity>
    </View>
  );
}
