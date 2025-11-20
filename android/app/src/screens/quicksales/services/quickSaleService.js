import firestore from "@react-native-firebase/firestore";

export async function registerQuickSale(payload) {
  await firestore().collection("sales").add({
    ...payload,
    createdAt: new Date(),
  });
}
