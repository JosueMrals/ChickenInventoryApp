import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/Ionicons';
import { TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import QuickSaleProductsScreen from '../screens/quicksalesNew/QuickSaleProductsScreen';
import QuickSaleCartScreen from '../screens/quicksalesNew/QuickSaleCartScreen';
import QuickSalePaymentScreen from '../screens/quicksalesNew/QuickSalePaymentScreen';
import QuickSaleDoneScreen from '../screens/quicksalesNew/QuickSaleDoneScreen';
import AssignCustomerScreen from '../screens/quicksalesNew/AssignCustomerScreen';
import ProductQuantityScreen from '../screens/quicksalesNew/ProductQuantityScreen';
import ProductEditScreen from '../screens/quicksalesNew/ProductEditScreen';

import { QuickSaleProvider } from '../screens/quicksalesNew/context/quickSaleContext';

const Stack = createNativeStackNavigator();

function BackButton() {
  const navigation = useNavigation();
  return (
    <TouchableOpacity onPress={() => navigation.goBack()} style={{paddingHorizontal: 8}}>
      <Icon name="chevron-back" size={28} color="#007AFF" />
    </TouchableOpacity>
  );
}

function BackToDashboardButton() {
  const navigation = useNavigation();

  return (
    <TouchableOpacity
      onPress={() =>
        navigation.navigate("DashboardScreen")
      }
      style={{ paddingHorizontal: 8 }}
    >
      <Icon name="chevron-back" size={26} color="#007AFF" />
    </TouchableOpacity>
  );
}

export default function QuickSaleStack() {
  return (
    <QuickSaleProvider>
      <Stack.Navigator
        initialRouteName="QuickSaleProducts"
        screenOptions={{
          headerShown: false,
          headerShadowVisible: false,
          headerBackTitleVisible: false,
          headerLeft: () => <BackButton />,
        }}
      >
        <Stack.Screen
          name="QuickSaleProducts"
          component={QuickSaleProductsScreen}
          initialParams={{ role: null, user: null }}
          options={{
            headerLeft: () => <BackToDashboardButton />,
          }}
        />

        <Stack.Screen
          name="QuickSaleCart"
          component={QuickSaleCartScreen}
        />
        <Stack.Screen
          name="QuickSalePayment"
          component={QuickSalePaymentScreen}
          options={{
			  title: "Pagar",
			  headerLeft: () => <BackButton />,
			  }}
        />
        <Stack.Screen
          name="QuickSaleDone"
          component={QuickSaleDoneScreen}
          options={{ title: "Pago realizado" }}
        />
        <Stack.Screen
           name="AssignCustomer"
           component={AssignCustomerScreen }
          />
        <Stack.Screen
          name="ProductQuantity"
          component={ProductQuantityScreen }
        />
        <Stack.Screen
          name="ProductEdit"
          component={ProductEditScreen }
        />
      </Stack.Navigator>
    </QuickSaleProvider>
  );
}
