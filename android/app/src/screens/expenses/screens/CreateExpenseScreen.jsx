import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Image,
  PermissionsAndroid,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import auth from '@react-native-firebase/auth';

import { createExpense, validateExpenseDraft, EXPENSE_CATEGORIES, PAYMENT_METHODS } from '../services/expenseService';
import { uploadExpenseReceipt, deleteExpenseReceipt } from '../services/expenseReceiptsService';
import { CATEGORY_LABELS, PAYMENT_METHOD_LABELS, getPaymentMethodImpactMessage } from '../utils/expenseLabels';
import { useSubmitLock } from '../../../hooks/useSubmitLock';
import styles, { COLORS } from '../styles/expensesStyles';

export default function CreateExpenseScreen({ navigation }) {
  const [category, setCategory] = useState(null);
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState(null);
  const [description, setDescription] = useState('');
  const [receipt, setReceipt] = useState(null); // { url, path, uploadedAt }
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const { submitting, runLocked } = useSubmitLock();

  // Captura/selección de la foto del comprobante — mismo patrón que
  // ReceptionCreateScreen.pickInvoicePhoto, adaptado al comprobante de gasto.
  const pickReceipt = async (fromCamera) => {
    try {
      if (fromCamera && Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.CAMERA,
          {
            title: 'Permiso de cámara',
            message: 'ChickenInventory necesita la cámara para fotografiar el comprobante.',
            buttonPositive: 'Permitir',
            buttonNegative: 'Cancelar',
          },
        );
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          Alert.alert('Permiso denegado', 'Activa el permiso de cámara en los ajustes para tomar fotos.');
          return;
        }
      }

      const pick = fromCamera ? launchCamera : launchImageLibrary;
      const result = await pick({ mediaType: 'photo', quality: 0.9, saveToPhotos: false });
      if (result.didCancel) return;
      if (result.errorCode) {
        Alert.alert('Error', result.errorMessage || 'No se pudo abrir la cámara/galería.');
        return;
      }
      const uri = result.assets?.[0]?.uri;
      if (!uri) return;

      setUploadingReceipt(true);
      const previous = receipt;
      const uid = auth().currentUser?.uid;
      const uploaded = await uploadExpenseReceipt(uri, uid);
      setReceipt(uploaded);
      if (previous?.path) deleteExpenseReceipt(previous.path);
    } catch (e) {
      console.error('[CreateExpense] error subiendo comprobante:', e?.code || e?.message || e);
      let msg = e?.message || 'No se pudo subir la foto.';
      if (e?.code === 'storage/unauthorized') msg = 'No tienes permisos para subir la foto (revisa las reglas de Storage).';
      if (e?.code === 'camera_unavailable') msg = 'La cámara no está disponible en este dispositivo.';
      Alert.alert('Error', msg);
    } finally {
      setUploadingReceipt(false);
    }
  };

  const removeReceipt = () => {
    const previous = receipt;
    setReceipt(null);
    if (previous?.path) deleteExpenseReceipt(previous.path);
  };

  const handleSubmit = () => {
    const validation = validateExpenseDraft({ amount, category, paymentMethod, receipt });
    if (!validation.ok) {
      Alert.alert('Datos incompletos', validation.message);
      return;
    }

    runLocked(
      async () => {
        try {
          const uid = auth().currentUser?.uid;
          await createExpense({
            amount: Number(amount),
            category,
            description: description.trim() || null,
            paymentMethod,
            receipt,
            createdByUid: uid,
          });
          Alert.alert('Gasto registrado', 'Tu gasto se registró correctamente.');
          navigation.goBack();
        } catch (e) {
          // El comprobante ya está subido y `receipt` sigue en el estado del
          // formulario: un reintento no vuelve a subir la foto, solo repite
          // la creación del documento.
          Alert.alert('Error', e?.message || 'No se pudo registrar el gasto.');
          throw e; // libera el cerrojo para poder reintentar
        }
      },
      { keepLockedOnSuccess: true },
    ).catch(() => {});
  };

  const canSubmit = !!category && !!amount && !!paymentMethod && !!receipt && !uploadingReceipt && !submitting;

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBack} onPress={() => navigation.goBack()}>
          <Icon name="chevron-back" size={26} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Registrar Gasto</Text>
        <View style={styles.headerBack} />
      </View>

      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={styles.formGroup}>
          <Text style={styles.label}>Categoría</Text>
          <View style={styles.chipsRow}>
            {EXPENSE_CATEGORIES.map((c) => (
              <TouchableOpacity
                key={c}
                style={[styles.chip, category === c && styles.chipActive]}
                onPress={() => setCategory(c)}
              >
                <Text style={[styles.chipText, category === c && styles.chipTextActive]}>{CATEGORY_LABELS[c]}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Monto</Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            placeholder="0.00"
            value={amount}
            onChangeText={setAmount}
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Método de pago</Text>
          <View style={styles.chipsRow}>
            {PAYMENT_METHODS.map((m) => (
              <TouchableOpacity
                key={m}
                style={[styles.chip, paymentMethod === m && styles.chipActive]}
                onPress={() => setPaymentMethod(m)}
              >
                <Text style={[styles.chipText, paymentMethod === m && styles.chipTextActive]}>
                  {PAYMENT_METHOD_LABELS[m]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {!!paymentMethod && (
          <View style={styles.impactBox}>
            <Text style={styles.impactText}>{getPaymentMethodImpactMessage(paymentMethod)}</Text>
          </View>
        )}

        <View style={styles.formGroup}>
          <Text style={styles.label}>Descripción (opcional)</Text>
          <TextInput
            style={[styles.input, styles.inputMultiline]}
            placeholder="Detalle del gasto..."
            value={description}
            onChangeText={setDescription}
            multiline
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Comprobante (obligatorio)</Text>

          {uploadingReceipt ? (
            <View style={styles.photoDropzone}>
              <ActivityIndicator size="large" color={COLORS.primary} />
              <Text style={styles.cardSub}>Subiendo foto...</Text>
            </View>
          ) : receipt?.url ? (
            <Image source={{ uri: receipt.url }} style={styles.photoPreview} resizeMode="cover" />
          ) : (
            <View style={styles.photoDropzone}>
              <Icon name="receipt-outline" size={34} color={COLORS.primary} />
              <Text style={styles.cardSub}>Aún no hay comprobante adjunto</Text>
            </View>
          )}

          <View style={styles.photoActionsRow}>
            <TouchableOpacity style={styles.photoActionBtn} onPress={() => pickReceipt(true)} disabled={uploadingReceipt}>
              <Icon name="camera-outline" size={18} color={COLORS.primary} />
              <Text style={styles.photoActionText}>{receipt?.url ? 'Tomar otra' : 'Tomar foto'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.photoActionBtn} onPress={() => pickReceipt(false)} disabled={uploadingReceipt}>
              <Icon name="images-outline" size={18} color={COLORS.primary} />
              <Text style={styles.photoActionText}>Galería</Text>
            </TouchableOpacity>
          </View>

          {receipt?.url && !uploadingReceipt && (
            <TouchableOpacity style={styles.ghostBtn} onPress={removeReceipt}>
              <Text style={[styles.ghostBtnText, { color: COLORS.red }]}>Quitar comprobante</Text>
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          style={[styles.primaryBtn, !canSubmit && styles.primaryBtnDisabled]}
          onPress={handleSubmit}
          disabled={!canSubmit}
        >
          {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Guardar gasto</Text>}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
