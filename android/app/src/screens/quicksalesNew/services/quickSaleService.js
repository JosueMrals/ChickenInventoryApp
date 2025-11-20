import firestore from '@react-native-firebase/firestore';

export async function registerQuickSale(data) {
  await firestore().collection('sales').add({
    ...data,
    createdAt: new Date(),
  });
}
