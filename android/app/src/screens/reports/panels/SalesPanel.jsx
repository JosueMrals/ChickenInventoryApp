import React, { useState } from 'react';
import { View, Text, FlatList, ActivityIndicator, StyleSheet } from 'react-native';
import OperationItem from '../components/OperationItem';
import SaleReceiptModal from '../components/SaleReceiptModal';
import LineChart from "../components/LineChartPRO";
import salesPanelStyles from "../styles/salesPanelStyles";
import { useSalesData } from "../hooks/useReportsData";

const SalesPanel = ({ summary, loadingSummary, dateFrom, dateTo, refreshKey }) => {
  const [selectedSale, setSelectedSale] = useState(null);
  const [isModalVisible, setIsModalVisible] = useState(false);

  // Hook dedicado: solo consulta sales + presales, independiente del resumen
  const {
    sales,
    loading: loadingSales,
    loadingMore,
    loadMore,
    hasMore,
  } = useSalesData(dateFrom, dateTo, refreshKey);

  const handleItemPress = (item) => {
    if (item.__kind === 'sale' || item.__kind === 'presale') {
      setSelectedSale(item);
      setIsModalVisible(true);
    }
  };

  const handleCloseModal = () => {
    setIsModalVisible(false);
    setSelectedSale(null);
  };

  const renderHeader = () => {
    const s = summary || {};
    const safe = {
        totalIncome: Number(s.totalIncome ?? 0),
        profit: Number(s.profit ?? 0),
        totalSalesCount: Number(s.totalSalesCount ?? 0),
        avgPerSale: Number(s.avgPerSale ?? 0),
        timeseries: Array.isArray(s.timeseries) ? s.timeseries : [],
    };

    if (loadingSummary && !sales.length) {
        return (
          <View style={salesPanelStyles.loadingContainer}>
            <View style={salesPanelStyles.skeletonCard} />
            <View style={salesPanelStyles.skeletonCard} />
            <View style={salesPanelStyles.skeletonChart} />
          </View>
        );
    }

    // Los KPIs se muestran si hay resumen, aunque no haya serie diaria. Antes la
    // condición exigía `timeseries.length > 0` y el resumen NUNCA devolvía esa
    // serie, así que la cabecera entera —KPIs y gráfica— jamás se pintaba.
    if (!summary) return null;

    return (
      <View style={{padding: 10}}>
          {/* ===================== KPIs FILA 1 ===================== */}
          <View style={salesPanelStyles.row}>
    
            <View style={salesPanelStyles.card}>
              <Text style={salesPanelStyles.cardLabel}>Ingresos</Text>
              <Text style={salesPanelStyles.cardValue}>C${safe.totalIncome.toFixed(2)}</Text>
            </View>
    
            <View style={salesPanelStyles.card}>
              <Text style={salesPanelStyles.cardLabel}>Ganancia</Text>
              <Text style={salesPanelStyles.cardValue}>C${safe.profit.toFixed(2)}</Text>
            </View>
    
          </View>
    
          {/* ===================== KPIs FILA 2 ===================== */}
          <View style={salesPanelStyles.row}>
    
            <View style={salesPanelStyles.card}>
              <Text style={salesPanelStyles.cardLabel}>Ventas</Text>
              <Text style={salesPanelStyles.cardValue}>{safe.totalSalesCount}</Text>
            </View>
    
            <View style={salesPanelStyles.card}>
              <Text style={salesPanelStyles.cardLabel}>Promedio</Text>
              <Text style={salesPanelStyles.cardValue}>C${safe.avgPerSale.toFixed(2)}</Text>
            </View>
    
          </View>
    
          {/* ===================== GRÁFICA ===================== */}
          {safe.timeseries.length > 0 && (
            <View style={salesPanelStyles.chartBox}>
              <Text style={salesPanelStyles.chartTitle}>Tendencia de ventas</Text>
              <LineChart data={safe.timeseries} />
            </View>
          )}
          <Text style={styles.listHeader}>Registro de Ventas</Text>
      </View>
    );
  };

  // Estado de carga inicial
  if (loadingSales && !sales.length) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Cargando ventas...</Text>
      </View>
    );
  }

  if (!sales.length) {
    return (
        <View style={{padding: 10}}>
            {renderHeader()}
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No hay ventas en este rango.</Text>
              <Text style={styles.emptySubText}>Prueba seleccionando otro período en el filtro.</Text>
            </View>
        </View>
    );
  }

  return (
    <View style={{flex: 1}}>
        <FlatList
            data={sales}
            ListHeaderComponent={renderHeader}
            renderItem={({ item }) => (
                <View style={{paddingHorizontal: 10}}>
                    <OperationItem
                        item={item}
                        onPress={() => handleItemPress(item)}
                    />
                </View>
            )}
            keyExtractor={item => item._uid}
            onEndReached={() => hasMore && loadMore ? loadMore() : null}
            onEndReachedThreshold={0.5}
            ListFooterComponent={
              loadingMore
                ? <ActivityIndicator style={{ marginVertical: 20 }} color="#007AFF" />
                : null
            }
        />
        <SaleReceiptModal
            sale={selectedSale}
            visible={isModalVisible}
            onClose={handleCloseModal}
        />
    </View>
  );
};

const styles = StyleSheet.create({
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingTop: 60,
        gap: 10,
    },
    loadingText: {
        fontSize: 14,
        color: '#9CA3AF',
    },
    emptyContainer: {
        alignItems: 'center',
        paddingTop: 40,
        paddingHorizontal: 24,
    },
    emptyText: {
        textAlign: 'center',
        fontSize: 16,
        fontWeight: '600',
        color: '#374151',
        marginBottom: 6,
    },
    emptySubText: {
        textAlign: 'center',
        fontSize: 13,
        color: '#9CA3AF',
    },
    listHeader: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
        paddingHorizontal: 5,
        marginTop: 20,
        marginBottom: 10,
    },
});

export default SalesPanel;