import React from 'react';
import { View, Text, TouchableOpacity, Animated } from 'react-native';
import { styles } from '../styles/userStyles';

const UserListItem = ({ item, currentUser, onDeleteUser, onEditPress }) => {
  return (
    <TouchableOpacity onPress={() => onEditPress(item)}>
      <Animated.View style={styles.listItemContainer}>
        <View style={styles.listItemContent}>
          <View>
            <Text style={styles.listItemEmail}>{item.email}</Text>
            <Text style={styles.listItemText}>Usuario: {item.user}</Text>
            <Text style={styles.listItemText}>Rol: {item.role ? item.role.toUpperCase() : 'N/A'}</Text>
            <Text
              style={[
                styles.listItemVerified,
                { color: item.verified ? '#007AFF' : '#FF9500' },
              ]}
            >
              {item.verified ? 'Verificado' : 'Pendiente de verificación'}
            </Text>
          </View>

          {item.id !== currentUser?.uid && (
            <TouchableOpacity onPress={() => onDeleteUser(item.id, item.email)}>
              <Text style={styles.deleteButtonText}>Eliminar</Text>
            </TouchableOpacity>
          )}
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
};

export default UserListItem;
