
import React from 'react';
import { View, Text } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import styles from './styles/productOperationItemStyles';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const ICONS = {
  create: 'add-circle',
  update: 'create',
  delete: 'trash',
};

const ICON_COLORS = {
  create: '#28a745',
  update: '#ffc107',
  delete: '#dc3545',
};

const ProductOperationItem = ({ item }) => {
  const { productName, operationType, timestamp, user, details } = item;

  const getOperationText = () => {
    switch (operationType) {
      case 'create':
        return `Producto "${productName}" fue creado.`;
      case 'update':
        const changedFields = Object.keys(details.changes).join(', ');
        return `Producto "${productName}" fue actualizado. Campos: ${changedFields}.`;
      case 'delete':
        return `Producto "${productName}" fue eliminado.`;
      default:
        return `Operación desconocida en "${productName}".`;
    }
  };

  return (
    <View style={styles.itemContainer}>
      <View style={styles.iconContainer}>
        <Icon
          name={ICONS[operationType] || 'alert-circle'}
          size={26}
          color={ICON_COLORS[operationType] || '#6c757d'}
        />
      </View>
      <View style={styles.contentContainer}>
        <View style={styles.details}>
          <Text style={styles.productName}>{getOperationText()}</Text>
          <Text style={styles.operationDetails}>
            {details && details.description ? details.description : ''}
          </Text>
        </View>
        <View style={styles.dateContainer}>
          <Text style={styles.date}>
            {format(new Date(timestamp.seconds * 1000), 'dd MMM yyyy, HH:mm', { locale: es })}
          </Text>
          <Text style={styles.user}>por {user}</Text>
        </View>
      </View>
    </View>
  );
};

export default ProductOperationItem;
