import auth from '@react-native-firebase/auth';
import type { TesterProfileResult } from './types';

export async function validateCurrentUserTester(): Promise<TesterProfileResult> {
  const currentUser = auth().currentUser;
  if (!currentUser?.uid) {
    return { isTester: false, role: null, uid: null, email: null };
  }

  const email = (currentUser?.email || '').trim();
  if (!email) {
    return { isTester: false, role: null, uid: currentUser.uid, email: null };
  }

  return {
    // La validacion real de tester se confirma al consultar App Distribution.
    isTester: true,
    role: null,
    uid: currentUser.uid,
    email,
  };
}



