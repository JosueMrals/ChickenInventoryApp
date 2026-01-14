import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import globalStyles from '../../styles/globalStyles';

const formatCurrency = (value) => `$${(Number(value) || 0).toFixed(2)}`;

const InfoRow = ({ label, value, icon }) => (
    <View style={styles.infoRow}>
        <View style={{flexDirection: 'row', alignItems: 'center'}}>
            {icon && <Icon name={icon} size={20} color="#555" style={{marginRight: 10}}/>}
            <Text style={styles.label}>{label}</Text>
        </View>
        <Text style={styles.value}>{value}</Text>
    </View>
);

const ItemCard = ({ item, isBonus = false }) => (
    <View style={[styles.itemCard, isBonus && styles.bonusItemCard]}>
        <View style={styles.itemInfo}>
            <Text style={styles.itemName}>{item.productName}</Text>
            <Text style={styles.itemDetails}>
                {isBonus ? `${item.quantity} x GRATIS` : `${item.quantity} x ${formatCurrency(item.unitPrice)}`}
            </Text>
        </View>
        {isBonus && (
            <View style={styles.bonusTag}><Text style={styles.bonusTagText}>REGALO</Text></View>
        )}
    </View>
);

export default function PreSaleDetailScreen({ route, navigation }) {
    const { presale } = route.params;

    const handleNavigateToPayment = () => {
        navigation.navigate('PreSalePayment', { presale });
    };

    const createdAt = presale.createdAt?.toDate ? presale.createdAt.toDate().toLocaleDateString('es-ES') : 'N/A';

    return (
        <View style={globalStyles.container}>
            <View style={globalStyles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Icon name="chevron-back" size={28} color="#FFF" />
                </TouchableOpacity>
                <Text style={globalStyles.title}>Detalle de Pre-Venta</Text>
                <View style={{ width: 28 }} />
            </View>

            <ScrollView contentContainerStyle={styles.scrollContainer}>
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Cliente</Text>
                    <InfoRow icon="person-outline" label="Nombre" value={`${presale.customer?.firstName || ''} ${presale.customer?.lastName || ''}`} />
                    <InfoRow icon="calendar-outline" label="Fecha" value={createdAt} />
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Productos</Text>
                    {presale.items.map((item, index) => <ItemCard key={`item-${index}`} item={item} />)}
                </View>

                {presale.bonuses && presale.bonuses.length > 0 && (
                    <View style={styles.section}>
                        <Text style={[styles.sectionTitle, {color: '#007AFF'}]}>Bonificaciones</Text>
                        {presale.bonuses.map((bonus, index) => <ItemCard key={`bonus-${index}`} item={bonus} isBonus />)}
                    </View>
                )}

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Resumen Financiero</Text>
                    <InfoRow label="Subtotal" value={formatCurrency(presale.subtotal)} />
                    <InfoRow label="Descuentos" value={`-${formatCurrency(presale.totalDiscount)}`} />
                    <View style={styles.totalRow}>
                        <Text style={styles.totalLabel}>Total</Text>
                        <Text style={styles.totalValue}>{formatCurrency(presale.total)}</Text>
                    </View>
                </View>
            </ScrollView>

            {presale.status === 'pending' && (
                <View style={styles.footer}>
                    <TouchableOpacity style={styles.payButton} onPress={handleNavigateToPayment}>
                        <Icon name="cash-outline" size={22} color="#fff" style={{marginRight: 10}}/>
                        <Text style={styles.payButtonText}>Proceder al Pago</Text>
                    </TouchableOpacity>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    scrollContainer: { padding: 16, paddingBottom: 100 },
    section: { backgroundColor: 'white', borderRadius: 12, padding: 16, marginBottom: 16, elevation: 2 },
    sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 12, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
    infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
    label: { fontSize: 15, color: '#666' },
    value: { fontSize: 15, fontWeight: '500', color: '#333' },
    itemCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F9F9F9', padding: 12, borderRadius: 8, marginBottom: 8 },
    bonusItemCard: { backgroundColor: '#E6F7FF' },
    itemInfo: { flex: 1 },
    itemName: { fontSize: 15, fontWeight: '600', color: '#333' },
    itemDetails: { fontSize: 13, color: '#777', marginTop: 2 },
    bonusTag: { backgroundColor: '#007AFF', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
    bonusTagText: { color: '#fff', fontSize: 11, fontWeight: 'bold' },
    totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, marginTop: 8, borderTopWidth: 1, borderTopColor: '#F0F0F0' },
    totalLabel: { fontSize: 18, fontWeight: 'bold', color: '#333' },
    totalValue: { fontSize: 20, fontWeight: 'bold', color: '#007AFF' },
    footer: { padding: 16, borderTopWidth: 1, borderTopColor: '#EEE', backgroundColor: '#FFF' },
    payButton: { backgroundColor: '#28A745', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', padding: 16, borderRadius: 12, elevation: 3 },
    payButtonText: { color: 'white', fontSize: 18, fontWeight: 'bold' }
});