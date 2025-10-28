import React from 'react';
import { SafeAreaView, StatusBar } from 'react-native';
import ProductList from './src/screens/ProductList';

export default function App() {
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <StatusBar barStyle="dark-content" />
      <ProductList />
    </SafeAreaView>
  );
}
