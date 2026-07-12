import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Alert, ScrollView,
  SafeAreaView, ActivityIndicator, PermissionsAndroid, Modal,
} from 'react-native';
import Animated, {
  useAnimatedStyle, useSharedValue, withSpring, withTiming, withSequence, runOnJS,
} from 'react-native-reanimated';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import * as customersService from '../../services/customersService';
import globalStyles from '../../styles/globalStyles';
import { useAdaptiveBottom } from '../../hooks/useAdaptiveBottom';
import { uploadCustomerPhoto, deleteCustomerPhoto } from './services/customerPhotosService';
import PhotoGallery from './components/PhotoGallery';
import ls from './styles/customerFormStyles';

function usePressScale() {
  const scale = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const onPressIn = () => { scale.value = withSpring(0.96, { damping: 14, stiffness: 260 }); };
  const onPressOut = () => { scale.value = withSpring(1, { damping: 14, stiffness: 260 }); };
  return { style, onPressIn, onPressOut };
}

const Field = React.memo(({ icon, label, value, onChangeText, placeholder, keyboard, editable = true, half, error, multiline }) => (
  <View style={[ls.fieldWrap, half && { flex: 1 }]}>
    <Text style={ls.label}>{label}</Text>
    <View style={[ls.inputRow, multiline && ls.inputRowMultiline, !editable && ls.inputDisabled, error && ls.inputRowError]}>
      {icon && (
        <View style={[ls.iconClay, multiline && ls.iconClayTop, !editable && ls.iconClayDisabled]}>
          <Icon name={icon} size={18} color={editable ? '#007AFF' : '#B0AABF'} />
        </View>
      )}
      <TextInput
        placeholder={placeholder}
        placeholderTextColor="#B0AABF"
        keyboardType={keyboard}
        editable={editable}
        value={value}
        onChangeText={onChangeText}
        style={[ls.input, multiline && ls.inputMultiline]}
        multiline={multiline}
        numberOfLines={multiline ? 3 : 1}
      />
    </View>
    {!!error && <Text style={ls.errorText}>{error}</Text>}
  </View>
));

function ClayPressable({ style, onPress, disabled, children }) {
  const press = usePressScale();
  return (
    <Animated.View style={press.style}>
      <TouchableOpacity
        style={style}
        onPress={onPress}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        disabled={disabled}
        activeOpacity={0.9}
      >
        {children}
      </TouchableOpacity>
    </Animated.View>
  );
}

function SavedOverlay({ visible, onDone }) {
  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (!visible) return;
    scale.value = 0;
    opacity.value = withTiming(1, { duration: 150 });
    scale.value = withSequence(
      withSpring(1.08, { damping: 9, stiffness: 220 }),
      withSpring(1, { damping: 12, stiffness: 220 }),
    );
    const timer = setTimeout(() => {
      opacity.value = withTiming(0, { duration: 200 }, (finished) => {
        if (finished) runOnJS(onDone)();
      });
    }, 1100);
    return () => clearTimeout(timer);
  }, [visible]);

  const cardStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  if (!visible) return null;

  return (
    <Modal transparent animationType="none" visible={visible} statusBarTranslucent>
      <View style={ls.successBackdrop}>
        <Animated.View style={[ls.successCard, cardStyle]}>
          <View style={ls.successIconWrap}>
            <Icon name="check-bold" size={34} color="#fff" />
          </View>
          <Text style={ls.successText}>Cliente guardado</Text>
        </Animated.View>
      </View>
    </Modal>
  );
}

export default function CustomerFormModal({ navigation, route }) {
  const { customer, customerId, role = 'vendedor' } = route?.params || {};
  const isEditing = !!(customer || customerId);
  const resolvedCustomerId = customer?.id || customerId;

  const [form, setForm] = useState({
    firstName: '', lastName: '', phone: '', address: '',
    cedula: '', creditLimit: '', type: 'Común', discount: '', photos: [],
  });
  const [errors, setErrors] = useState({});
  const [loadingCustomer, setLoadingCustomer] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const { bottomPadding } = useAdaptiveBottom();

  const canEditSensitive = role === 'admin';
  const canEditCustomer = role === 'admin' || role === 'vendedor';

  const set = (key) => (val) => {
    setForm((f) => ({ ...f, [key]: val }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const applyCustomerToForm = (value) => {
    if (!value) {
      setForm({ firstName: '', lastName: '', phone: '', address: '', cedula: '', creditLimit: '', type: 'Común', discount: '', photos: [] });
      return;
    }
    setForm({
      firstName: value.firstName || '', lastName: value.lastName || '',
      phone: value.phone || '', address: value.address || '',
      cedula: value.cedula || '',
      creditLimit: value.creditLimit != null ? String(value.creditLimit) : '',
      type: value.type || 'Común',
      discount: value.discount != null ? String(value.discount) : '',
      photos: Array.isArray(value.photos) ? value.photos : [],
    });
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      if (customer) { applyCustomerToForm(customer); return; }
      if (!customerId) { applyCustomerToForm(null); return; }
      setLoadingCustomer(true);
      try {
        const fetched = await customersService.getCustomerById(customerId);
        if (alive) applyCustomerToForm(fetched);
      } catch (e) {
        if (alive) Alert.alert('Error', 'No se pudo cargar el cliente.');
      } finally {
        if (alive) setLoadingCustomer(false);
      }
    })();
    return () => { alive = false; };
  }, [customer, customerId]);

  const handleClose = () => navigation.goBack();

  const handleSave = async () => {
    const nextErrors = {};
    if (!form.firstName.trim()) nextErrors.firstName = 'El nombre es obligatorio';
    if (!form.phone.trim()) nextErrors.phone = 'El teléfono es obligatorio';
    if (nextErrors.firstName || nextErrors.phone) {
      setErrors(nextErrors);
      return;
    }
    if (!canEditCustomer) {
      Alert.alert('No autorizado', 'No tienes permisos para editar este cliente.');
      return;
    }
    if (customer && !canEditSensitive) {
      if (parseFloat(form.creditLimit || 0) !== (customer.creditLimit ?? 0)) {
        Alert.alert('No autorizado', 'Solo admin puede cambiar el límite de crédito.'); return;
      }
      if (parseFloat(form.discount || 0) !== (customer.discount ?? 0)) {
        Alert.alert('No autorizado', 'Solo admin puede cambiar el descuento.'); return;
      }
    }

    const payload = {
      firstName: form.firstName.trim(), lastName: form.lastName.trim(),
      phone: form.phone.trim(), address: form.address.trim(),
      cedula: form.cedula.trim(),
      creditLimit: parseFloat(form.creditLimit) || 0,
      type: form.type, discount: parseFloat(form.discount) || 0,
    };

    setSaving(true);
    try {
      if (customer) await customersService.updateCustomer(customer.id, payload);
      else await customersService.createCustomer(payload);
      setShowSaved(true);
    } catch (e) {
      Alert.alert('Error', e.message || 'No se pudo guardar');
    } finally {
      setSaving(false);
    }
  };

  const pickAndUploadPhoto = async (fromCamera) => {
    try {
      if (fromCamera) {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.CAMERA,
          {
            title: 'Permiso de cámara',
            message: 'ChickenInventory necesita acceso a la cámara para tomar la foto del cliente.',
            buttonPositive: 'Permitir',
            buttonNegative: 'Cancelar',
          },
        );
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          Alert.alert('Permiso denegado', 'Activa el permiso de cámara en los ajustes de la app para tomar fotos.');
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

      setUploadingPhoto(true);
      const photo = await uploadCustomerPhoto(resolvedCustomerId, uri);
      const nextPhotos = [...(form.photos || []), photo];
      setForm((f) => ({ ...f, photos: nextPhotos }));
      await customersService.updateCustomer(resolvedCustomerId, { photos: nextPhotos });
    } catch (e) {
      console.error('[CustomerFormModal] Error al subir foto:', e?.code || e?.message || e);
      let msg = e?.message || 'No se pudo subir la foto.';
      if (e?.code === 'storage/unauthorized') msg = 'No tienes permisos para subir fotos (revisa las reglas de Storage).';
      if (e?.code === 'storage/canceled') msg = 'Se canceló la subida de la foto.';
      if (e?.code === 'storage/quota-exceeded') msg = 'Se alcanzó el límite de almacenamiento.';
      if (e?.code === 'camera_unavailable') msg = 'La cámara no está disponible en este dispositivo.';
      Alert.alert('Error', msg);
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleDeletePhoto = (photo) => {
    Alert.alert('Eliminar foto', '¿Seguro que deseas eliminar esta foto?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteCustomerPhoto(photo.path);
            const nextPhotos = (form.photos || []).filter((p) => p.path !== photo.path);
            setForm((f) => ({ ...f, photos: nextPhotos }));
            await customersService.updateCustomer(resolvedCustomerId, { photos: nextPhotos });
          } catch (e) {
            Alert.alert('Error', 'No se pudo eliminar la foto.');
          }
        },
      },
    ]);
  };

  const customerTypes = ['Común', 'Semi-mayorista', 'Mayorista'];

  return (
    <SafeAreaView style={ls.safe}>
      {/* Header */}
      <View style={globalStyles.header}>
        <TouchableOpacity onPress={handleClose} style={ls.headerBack} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Icon name="arrow-left" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={globalStyles.title}>{isEditing ? 'Editar cliente' : 'Nuevo cliente'}</Text>
      </View>

      <ScrollView style={ls.scrollBody} contentContainerStyle={ls.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

        {loadingCustomer && (
          <View style={ls.loadingRow}>
            <ActivityIndicator size="small" color="#007AFF" />
            <Text style={ls.loadingText}>Cargando...</Text>
          </View>
        )}

        {/* ── Información personal ── */}
        <Text style={ls.sectionTitle}>Información personal</Text>
        <View style={ls.card}>
          <View style={ls.row}>
            <Field icon="account" label="Nombres *" value={form.firstName} onChangeText={set('firstName')} placeholder="Nombres" half error={errors.firstName} />
            <View style={{ width: 8 }} />
            <Field icon="account-outline" label="Apellidos" value={form.lastName} onChangeText={set('lastName')} placeholder="Apellidos" half />
          </View>
          <Field icon="phone" label="Teléfono *" value={form.phone} onChangeText={set('phone')} placeholder="8888-0000" keyboard="phone-pad" error={errors.phone} />
          <Field icon="card-account-details-outline" label="Cédula" value={form.cedula} onChangeText={set('cedula')} placeholder="000-000000-0000X" />
          <Field icon="map-marker-outline" label="Dirección" value={form.address} onChangeText={set('address')} placeholder="Dirección del cliente" multiline />
        </View>

        {/* ── Tipo de cliente ── */}
        <Text style={ls.sectionTitle}>Tipo de cliente</Text>
        <View style={ls.card}>
          <View style={ls.typesRow}>
            {customerTypes.map((t) => {
              const active = form.type === t;
              return (
                <ClayPressable key={t} onPress={() => set('type')(t)} style={[ls.typeChip, active && ls.typeChipActive]}>
                  <Icon name={active ? 'check-circle' : 'circle-outline'} size={16} color={active ? '#fff' : '#9A93AA'} />
                  <Text style={[ls.typeChipText, active && ls.typeChipTextActive]}>{t}</Text>
                </ClayPressable>
              );
            })}
          </View>
        </View>

        {/* ── Configuración financiera ── */}
        <Text style={ls.sectionTitle}>Configuración financiera</Text>
        <View style={ls.card}>
          {!canEditSensitive && (
            <View style={ls.lockBanner}>
              <Icon name="lock-outline" size={16} color="#B4690A" />
              <Text style={ls.lockText}>Solo admin puede modificar estos campos</Text>
            </View>
          )}
          <View style={ls.row}>
            <Field icon="percent" label="Descuento (%)" value={String(form.discount)} onChangeText={set('discount')} placeholder="0" keyboard="numeric" editable={canEditSensitive} half />
            <View style={{ width: 8 }} />
            <Field icon="cash" label="Límite de crédito" value={String(form.creditLimit)} onChangeText={set('creditLimit')} placeholder="0.00" keyboard="numeric" editable={canEditSensitive} half />
          </View>
        </View>

        {/* ── Fotos ── */}
        <Text style={ls.sectionTitle}>Fotos</Text>
        <View style={ls.card}>
          {isEditing ? (
            <>
              <PhotoGallery photos={form.photos} onDelete={handleDeletePhoto} />
              <View style={[ls.row, { marginTop: 10 }]}>
                <ClayPressable style={ls.photoBtn} onPress={() => pickAndUploadPhoto(true)} disabled={uploadingPhoto}>
                  <Icon name="camera-outline" size={18} color="#007AFF" />
                  <Text style={ls.photoBtnText}>Tomar foto</Text>
                </ClayPressable>
                <View style={{ width: 8 }} />
                <ClayPressable style={ls.photoBtn} onPress={() => pickAndUploadPhoto(false)} disabled={uploadingPhoto}>
                  <Icon name="image-outline" size={18} color="#007AFF" />
                  <Text style={ls.photoBtnText}>Galería</Text>
                </ClayPressable>
              </View>
              {uploadingPhoto && (
                <View style={[ls.loadingRow, { marginTop: 8, marginBottom: 0 }]}>
                  <ActivityIndicator size="small" color="#007AFF" />
                  <Text style={ls.loadingText}>Subiendo foto...</Text>
                </View>
              )}
            </>
          ) : (
            <Text style={ls.hintText}>Guarda el cliente primero para poder agregar fotos.</Text>
          )}
        </View>
      </ScrollView>

      {/* ── Botón (fijo abajo, respeta gestos/barra de navegación) ── */}
      <View style={[ls.footer, { paddingBottom: bottomPadding }]}>
        <ClayPressable style={ls.btnSave} onPress={handleSave} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" size="small" /> : (
            <>
              <Icon name="content-save-outline" size={20} color="#fff" />
              <Text style={ls.btnSaveText}>Guardar cliente</Text>
            </>
          )}
        </ClayPressable>
      </View>

      <SavedOverlay visible={showSaved} onDone={handleClose} />
    </SafeAreaView>
  );
}
