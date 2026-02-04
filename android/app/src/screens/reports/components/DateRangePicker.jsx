import React, { useState } from "react";
import { View, Text, TouchableOpacity, Platform } from "react-native";
import DateTimePickerModal from "react-native-modal-datetime-picker";
import styles from "../styles/reportsStyles";

export default function DateRangePicker({ onChange }) {

  const [isDatePickerVisible, setDatePickerVisible] = useState(false);
  const [currentMode, setCurrentMode] = useState("from");

  const [dateFrom, setDateFrom] = useState(null);
  const [dateTo, setDateTo] = useState(null);

  const showPicker = (mode) => {
    setCurrentMode(mode);
    setDatePickerVisible(true);
  };

  const hidePicker = () => setDatePickerVisible(false);

  const handleConfirm = (selectedDate) => {
    hidePicker();

    if (currentMode === "from") {
      setDateFrom(selectedDate);
      if (dateTo) onChange(selectedDate, dateTo);
    } else {
      setDateTo(selectedDate);
      if (dateFrom) onChange(dateFrom, selectedDate);
    }
  };

  return (
    <View style={styles.datePickerContainer}>
      <TouchableOpacity onPress={() => showPicker("from")} style={styles.dateBox}>
        <Text style={styles.dateLabel}>Desde:</Text>
        <Text style={styles.dateValue}>
          {dateFrom ? dateFrom.toLocaleDateString() : "Seleccionar"}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => showPicker("to")} style={styles.dateBox}>
        <Text style={styles.dateLabel}>Hasta:</Text>
        <Text style={styles.dateValue}>
          {dateTo ? dateTo.toLocaleDateString() : "Seleccionar"}
        </Text>
      </TouchableOpacity>

      <DateTimePickerModal
        isVisible={isDatePickerVisible}
        mode="date"
        display={Platform.OS === "ios" ? "inline" : "calendar"}
        onConfirm={handleConfirm}
        onCancel={hidePicker}
      />
    </View>
  );
}
