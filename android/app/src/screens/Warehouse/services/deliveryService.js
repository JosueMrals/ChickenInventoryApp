import functions from '@react-native-firebase/functions';
import auth from '@react-native-firebase/auth';

export const completePreSalePayment = async (preSaleId, amountPaid = 0) => {
  try {
    const user = auth().currentUser;
    if (!user) throw new Error("El usuario debe estar autenticado.");

    // Obtener token para enviarlo explícitamente y evitar errores de contexto
    const token = await user.getIdToken();

    const fn = functions().httpsCallable('completePreSalePayment');
    const response = await fn({ preSaleId, authToken: token, amountPaid });
    return response.data;
  } catch (error) {
    console.error("Error completing payment:", error);
    throw error;
  }
};
