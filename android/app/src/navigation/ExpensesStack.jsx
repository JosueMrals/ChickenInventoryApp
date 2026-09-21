import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import ExpensesScreen from '../screens/expenses/screens/ExpensesScreen';
import CreateExpenseScreen from '../screens/expenses/screens/CreateExpenseScreen';
import ExpenseDetailScreen from '../screens/expenses/screens/ExpenseDetailScreen';
import ExpenseReviewScreen from '../screens/expenses/screens/ExpenseReviewScreen';

const Stack = createNativeStackNavigator();

// Stack del módulo Gastos Operativos. Recibe user/role por params (igual que
// ProductsStack/ReceptionStack) y los reinyecta a cada pantalla vía initialParams.
export default function ExpensesStack({ route }) {
  const { user, role } = route?.params ?? {};

  return (
    <Stack.Navigator
      initialRouteName="ExpensesHome"
      screenOptions={{ headerShown: false }}
    >
      <Stack.Screen name="ExpensesHome" component={ExpensesScreen} initialParams={{ user, role }} />
      <Stack.Screen name="CreateExpense" component={CreateExpenseScreen} initialParams={{ user, role }} />
      <Stack.Screen name="ExpenseDetail" component={ExpenseDetailScreen} initialParams={{ user, role }} />
      <Stack.Screen name="ExpenseReview" component={ExpenseReviewScreen} initialParams={{ user, role }} />
    </Stack.Navigator>
  );
}
