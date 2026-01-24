import React from 'react';
import { FlatList, View, ActivityIndicator } from 'react-native';
import UserListItem from './UserListItem';
import { styles } from '../styles/userStyles';

const UserList = ({ users, loading, currentUser, onDeleteUser, onEditUser }) => {
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <FlatList
      data={users}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <UserListItem
          item={item}
          currentUser={currentUser}
          onDeleteUser={onDeleteUser}
          onEditPress={onEditUser}
        />
      )}
      contentContainerStyle={{ paddingVertical: 10 }}
    />
  );
};

export default UserList;
