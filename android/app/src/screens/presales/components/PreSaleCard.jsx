import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { resolveCustomerName } from '../../../utils/customerUtils';

const formatDate = (timestamp) => {
    if (!timestamp || !timestamp.toDate) return 'Fecha inválida';
    return timestamp.toDate().toLocaleDateString('es-ES', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
    });
};

const formatCurrency = (value) => `$${(Number(value) || 0).toFixed(2)}`;

function PreSaleCard({ presale, customerName }) {
    const hasBonuses = presale.bonuses && presale.bonuses.length > 0;
    const displayName = customerName || resolveCustomerName(presale);
    const isCredit = presale.paymentMethod === 'credit' || presale.status === 'credit_pending';

    return (
        <View style={styles.card}>
            <View style={styles.header}>
                <View style={styles.headerInfo}>
                    <Icon name="person-circle-outline" size={20} color="#555" />
                    <Text style={styles.customerName}>
                        {displayName}
                    </Text>
                </View>
                <View style={styles.headerBadges}>
                    {isCredit && (
                        <View style={styles.creditBadge}>
                            <Text style={styles.creditText}>Crédito</Text>
                        </View>
                    )}
                    <View style={[styles.statusBadge, ['paid', 'partially_returned', 'returned'].includes(presale.status) ? styles.paidBadge : styles.pendingBadge]}>
                        <Text style={styles.statusText}>
                            {presale.status === 'returned' ? 'Devuelta'
                                : presale.status === 'partially_returned' ? 'Dev. parcial'
                                : presale.status === 'paid' ? 'Pagada' : 'Pendiente'}
                        </Text>
                    </View>
                </View>
            </View>

            <View style={styles.content}>
                <View style={styles.detailRow}>
                    <Text style={styles.label}>Fecha:</Text>
                    <Text style={styles.value}>{formatDate(presale.createdAt)}</Text>
                </View>
                <View style={styles.detailRow}>
                    <Text style={styles.label}>Items:</Text>
                    <Text style={styles.value}>{presale.items?.length || 0}</Text>
                </View>
                {hasBonuses && (
                    <View style={styles.detailRow}>
                        <Text style={[styles.label, styles.bonusLabel]}>Bonificaciones:</Text>
                        <View style={{flexDirection: 'row', alignItems: 'center'}}>
                            <Icon name="gift" size={16} color="#007AFF" style={{marginRight: 4}}/>
                            <Text style={[styles.value, styles.bonusValue]}>{presale.bonuses.length}</Text>
                        </View>
                    </View>
                )}
            </View>

            <View style={styles.footer}>
                <Text style={styles.totalLabel}>Total:</Text>
                <Text style={styles.totalAmount}>{formatCurrency(presale.total)}</Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: 'white',
        borderRadius: 12,
        marginHorizontal: 16,
        marginVertical: 8,
        padding: 16,
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
    },
    headerInfo: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        flex: 1,
        minWidth: 0,
        paddingRight: 10,
    },
    customerName: {
        fontSize: 16,
        fontWeight: 'bold',
        marginLeft: 8,
        color: '#333',
        flexShrink: 1,
        flexWrap: 'wrap',
    },
    headerBadges: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
        flexShrink: 0,
        gap: 6,
    },
    creditBadge: {
        backgroundColor: '#FFF4E5',
        borderRadius: 10,
        paddingHorizontal: 8,
        paddingVertical: 3,
    },
    creditText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#B45309',
    },
    statusBadge: {
        borderRadius: 12,
        paddingHorizontal: 10,
        paddingVertical: 4,
    },
    pendingBadge: { backgroundColor: '#FFF2E5' },
    paidBadge: { backgroundColor: '#E6F7FF' },
    statusText: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#555',
    },
    content: {
        paddingVertical: 12,
    },
    detailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 4,
    },
    label: {
        fontSize: 14,
        color: '#666',
    },
    value: {
        fontSize: 14,
        fontWeight: '500',
        color: '#333',
    },
    bonusLabel: { color: '#007AFF' },
    bonusValue: { color: '#007AFF', fontWeight: 'bold' },
    footer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#F0F0F0',
    },
    totalLabel: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#333',
    },
    totalAmount: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#007AFF',
    },
});
// memo: componente de fila. Sin esto se re-renderiza en cada cambio de estado
// del padre (tecla del buscador, cambio de filtro) aunque su item no haya cambiado.
export default React.memo(PreSaleCard);
