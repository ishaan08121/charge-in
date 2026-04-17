import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const MapView = ({ style, children }) => (
  <View style={[styles.map, style]}>
    <Text style={styles.label}>Map not available on web</Text>
    {children}
  </View>
);

export const Marker = () => null;
export const PROVIDER_GOOGLE = 'google';
export const PROVIDER_DEFAULT = null;
export default MapView;

const styles = StyleSheet.create({
  map: {
    backgroundColor: '#e0e0e0',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 200,
  },
  label: {
    color: '#888',
    fontSize: 14,
  },
});
