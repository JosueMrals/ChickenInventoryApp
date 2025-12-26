import React, { useState } from 'react';
import { View, Text, FlatList, ActivityIndicator, StyleSheet } from 'react-native';
import OperationItem from '../components/OperationItem';
import SaleReceiptModal from '../components/SaleReceiptModal';
import LineChart from "../components/LineChartPRO";
import salesPanelStyles from "../styles/salesPanelStyles";

const SalesPanel = ({ data, loading, loadMore, hasMore }) => {
  const [selectedSale, setSelectedSale] = useState(null);
  const [isModalVisible, setIsModalVisible] = useState(false);

  const handleItemPress = (item) => {
    if (item.__kind === 'sale') {
      setSelectedSale(item);
      setIsModalVisible(true);
    }
  };

  const handleCloseModal = () => {
    setIsModalVisible(false);
    setSelectedSale(null);
  };
  
  const salesOperations = data.operations?.filter(op => op.__kind === 'sale');

  const renderHeader = () => {
    const summary = data.summary || {};
    const safe = {
        totalIncome: Number(summary.totalIncome ?? 0),
        profit: Number(summary.profit ?? 0),
        totalSalesCount: Number(summary.totalSalesCount ?? 0),
        avgPerSale: Number(summary.avgPerSale ?? 0),
        timeseries: Array.isArray(summary.timeseries) ? summary.timeseries : [],
    };
    
    const noData = safe.timeseries.length === 0 || isNaN(safe.totalIncome) || isNaN(safe.profit);

    if (loading && !data?.operations?.length) {
        return (
          <View style={salesPanelStyles.loadingContainer}>
            <View style={salesPanelStyles.skeletonCard} />
            <View style={salesPanelStyles.skeletonCard} />
            <View style={salesPanelStyles.skeletonChart} />
          </View>
        );
    }
      
    if (noData) {
        return null; // No mostrar nada si no hay datos
    }

    return (
      <View style={{padding: 10}}>
          {/* ===================== KPIs FILA 1 ===================== */}
          <View style={salesPanelStyles.row}>
    
            <View style={salesPanelStyles.card}>
              <Text style={salesPanelStyles.cardLabel}>Ingresos</Text>
              <Text style={salesPanelStyles.cardValue}>${safe.totalIncome.toFixed(2)}</Text>
            </View>
    
            <View style={salesPanelStyles.card}>
              <Text style={salesPanelStyles.cardLabel}>Ganancia</Text>
              <Text style={salesPanelStyles.cardValue}>${safe.profit.toFixed(2)}</Text>
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
              <Text style={salesPanelStyles.cardValue}>${safe.avgPerSale.toFixed(2)}</Text>
            </View>
    
          </View>
    
          {/* ===================== GRÁFICA ===================== */}
          <View style={salesPanelStyles.chartBox}>
            <Text style={salesPanelStyles.chartTitle}>Tendencia de ventas</Text>
            <LineChart data={safe.timeseries} />
          </View>
          <Text style={styles.listHeader}>Registro de Ventas</Text>
      </View>
    );
  };

  if (loading && !salesOperations?.length) {
    return <ActivityIndicator style={{ marginTop: 20 }} size="large" color="#0000ff" />;
  }
  
  if (!salesOperations?.length) {
    return (
        <View style={{padding: 10}}>
            {renderHeader()}
            <Text style={styles.emptyText}>No hay ventas en este rango.</Text>
        </View>
    )
  }

  return (
    <View style={{flex: 1}}>
        <FlatList
            data={salesOperations}
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
            ListFooterComponent={loading && hasMore ? <ActivityIndicator style={{ marginVertical: 20 }} /> : null}
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
    emptyText: {
        textAlign: 'center',
        padding: 20,
        color: '#777',
        marginTop: 10,
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