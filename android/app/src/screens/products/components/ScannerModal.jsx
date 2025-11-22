import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, Modal, StyleSheet } from "react-native";
import { Camera, useCameraDevice } from "react-native-vision-camera";
import { scanBarcodes, BarcodeFormat } from "@react-native-ml-kit/barcode-scanning";

export default function ScannerModal({ visible, onClose, onScanned }) {
  const device = useCameraDevice("back");
  const [permission, setPermission] = useState(false);

  useEffect(() => {
    Camera.requestCameraPermission().then((res) => {
      setPermission(res === "granted");
    });
  }, []);

  const processFrame = async (frame) => {
    const result = await scanBarcodes(frame, [
      BarcodeFormat.EAN_13,
      BarcodeFormat.EAN_8,
      BarcodeFormat.CODE_128,
      BarcodeFormat.CODE_39,
      BarcodeFormat.QR_CODE
    ]);

    if (result.length > 0) {
      onScanned(result[0].rawValue);
    }
  };

  if (!device || !permission) return null;

  return (
    <Modal visible={visible} animationType="slide">
      <View style={styles.container}>
        <Camera
          style={styles.camera}
          isActive={visible}
          device={device}
          onFrameProcessor={processFrame}
          frameProcessorFps={5}
        />

        <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>

        <View style={styles.frame} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "black" },
  camera: { flex: 1 },
  closeBtn: {
    position: "absolute",
    top: 40,
    right: 20,
    padding: 10,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 50
  },
  closeText: { color: "#FFF", fontSize: 28 },
  frame: {
    position: "absolute",
    top: "28%",
    width: "80%",
    left: "10%",
    height: "45%",
    borderColor: "#00FF66",
    borderWidth: 3,
    borderRadius: 12
  }
});
