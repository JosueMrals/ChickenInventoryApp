import React from 'react';
import { View, ScrollView, TouchableOpacity, Text, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import globalStyles from '../../../styles/globalStyles';
import { usePreSaleAggregates } from '../hooks/usePreSaleAggregates';
import PreSoldSummaryPanel from '../components/PreSoldSummaryPanel';
import DelivererAssignmentsPanel from '../components/DelivererAssignmentsPanel';

export default function ProductsAggregatesScreen({ navigation }) {
  const { preSold, delivererAssignments, loading } = usePreSaleAggregates();

  return (
    <View style={globalStyles.container}>
      <View style={globalStyles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="chevron-back" size={26} color="#fff" />
        </TouchableOpacity>
        <Text style={globalStyles.title}>Resumen de Stock</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <PreSoldSummaryPanel items={preSold} loading={loading} />
        <DelivererAssignmentsPanel assignments={delivererAssignments} loading={loading} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: 10,
    paddingBottom: 24,
  },
});

