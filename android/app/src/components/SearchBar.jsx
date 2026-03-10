import React from 'react';
import { View, TextInput, StyleSheet, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';

export default function SearchBar({
  value,
  placeholder,
  placeholderTextColor = '#999',
  onChangeText,
  onClear,
  style,
  inputStyle,
  autoFocus = false,
  returnKeyType = 'search',
  onSubmitEditing,
  editable = true,
  ...inputProps
}) {
  const showClear = Boolean(value);

  const handleClear = () => {
    if (typeof onClear === 'function') {
      onClear();
      return;
    }
    if (typeof onChangeText === 'function') {
      onChangeText('');
    }
  };

  return (
    <View style={[styles.container, style]}>
      <View style={[styles.inputContainer, !editable && styles.inputContainerDisabled]}>
        <Icon name="search" size={20} color="#999" style={styles.icon} />

        <TextInput
          style={[styles.input, inputStyle]}
          placeholder={placeholder || 'Buscar...'}
          placeholderTextColor={placeholderTextColor}
          value={value}
          onChangeText={onChangeText}
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus={autoFocus}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
          editable={editable}
          clearButtonMode="never"
          {...inputProps}
        />

        {showClear ? (
          <TouchableOpacity onPress={handleClear} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
            <Icon name="close-circle" size={20} color="#999" style={styles.clearIcon} />
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    marginBottom: 10,
    marginTop: 10,
  },
  inputContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 12,
    alignItems: 'center',
    height: 48,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  inputContainerDisabled: {
    opacity: 0.7,
  },
  icon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  clearIcon: {
    marginLeft: 8,
  },
});
