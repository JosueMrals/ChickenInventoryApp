import React, { useState } from 'react';
import { View, Image, TouchableOpacity, Modal, Text } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import ls from '../styles/photoGalleryStyles';

export default function PhotoGallery({ photos = [], onDelete, emptyText = 'Sin fotos todavía' }) {
  const [viewerUri, setViewerUri] = useState(null);

  if (!photos.length) {
    return <Text style={ls.emptyText}>{emptyText}</Text>;
  }

  return (
    <View style={ls.grid}>
      {photos.map((photo) => (
        <TouchableOpacity key={photo.path || photo.url} style={ls.thumbWrap} onPress={() => setViewerUri(photo.url)} activeOpacity={0.85}>
          <Image source={{ uri: photo.url }} style={ls.thumb} />
          {!!onDelete && (
            <TouchableOpacity
              style={ls.deleteBadge}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              onPress={() => onDelete(photo)}
            >
              <Icon name="close" size={12} color="#fff" />
            </TouchableOpacity>
          )}
        </TouchableOpacity>
      ))}

      <Modal visible={!!viewerUri} transparent animationType="fade" onRequestClose={() => setViewerUri(null)}>
        <View style={ls.viewerBackdrop}>
          <TouchableOpacity style={ls.viewerClose} onPress={() => setViewerUri(null)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Icon name="close" size={26} color="#fff" />
          </TouchableOpacity>
          {!!viewerUri && <Image source={{ uri: viewerUri }} style={ls.viewerImage} resizeMode="contain" />}
        </View>
      </Modal>
    </View>
  );
}
