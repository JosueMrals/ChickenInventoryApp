import React, { useRef, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import ViewShot from 'react-native-view-shot';
import RNFS from 'react-native-fs';
import Share from 'react-native-share';
import styles from '../styles/reportsStyles';

export default function ReportExportModal({ visible, onClose, payload }) {
  const shotRef = useRef();
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    try {
      setLoading(true);
      const uri = await shotRef.current.capture();

      // convertir a pdf no trivial; como alternativa guardamos PNG y compartimos
      const dest = `${RNFS.CachesDirectoryPath}/report-${Date.now()}.png`;
      await RNFS.copyFile(uri, dest);

      await Share.open({ url: 'file://' + dest, title: 'Informe' });
    } catch (e) {
      console.error('Export error', e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.exportOverlay}>
        <View style={styles.exportBox}>
          <Text style={styles.title}>Exportar Informe</Text>

          <ViewShot ref={shotRef} options={{ format: 'png', quality: 0.9 }} style={{ flex: 1 }}>
            {/* Renderiza un componente resumen básico usando payload */}
            <View style={{ padding: 12 }}>
              <Text>Informe generado: {new Date().toLocaleString()}</Text>
              <Text>Ventas: {payload.salesSummary?.totalIncome || 0}</Text>
              <Text>Ingresos: {payload.financialSummary?.incomes || 0}</Text>
              {/* agrega más contenido */}
            </View>
          </ViewShot>

          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10 }}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}><Text>Cancelar</Text></TouchableOpacity>
            <TouchableOpacity style={styles.saveBtn} onPress={handleExport}>
              {loading ? <ActivityIndicator /> : <Text>Exportar / Compartir</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
