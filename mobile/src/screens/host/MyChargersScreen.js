import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Alert, ActivityIndicator, Switch, Image, RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { apiGetMyChargers, apiUpdateCharger, apiDeleteCharger } from '../../api/chargers';
import { useChargerStore } from '../../store/chargerStore';
import { useColors } from '../../constants/colors';

export default function MyChargersScreen({ navigation }) {
  const colors = useColors();
  const styles = makeStyles(colors);
  const [chargers, setChargers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState(null);
  const removeChargerFromStore = useChargerStore(s => s.removeCharger);

  async function load() {
    setLoading(true);
    try {
      const { data } = await apiGetMyChargers();
      setChargers(data.chargers || []);
    } catch {
      Alert.alert('Error', 'Could not load your chargers');
    } finally {
      setLoading(false);
    }
  }

  useFocusEffect(
    useCallback(() => { load(); }, [])
  );

  async function toggleAvailability(charger) {
    setTogglingId(charger.id);
    try {
      const { data } = await apiUpdateCharger(charger.id, {
        is_available: !charger.is_available,
      });
      setChargers(prev =>
        prev.map(c => c.id === charger.id ? { ...c, is_available: data.charger.is_available } : c)
      );
    } catch {
      Alert.alert('Error', 'Could not update availability');
    } finally {
      setTogglingId(null);
    }
  }

  function confirmDelete(charger) {
    Alert.alert(
      'Delist Charger',
      `Are you sure you want to delist "${charger.title}" ? `,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delist',
          style: 'destructive',
          onPress: () => deleteCharger(charger.id),
        },
      ]
    );
  }

  async function deleteCharger(id) {
    try {
      await apiDeleteCharger(id);
      setChargers(prev => prev.filter(c => c.id !== id));
      removeChargerFromStore(id); // instantly remove from map too
    } catch {
      Alert.alert('Error', 'Could not delist charger');
    }
  }

  if (loading && !chargers.length) {
    return <View style={styles.center}><ActivityIndicator color={colors.primary} size="large" /></View>;
  }

  return (
    <FlatList
      data={chargers}
      keyExtractor={c => c.id}
      style={styles.container}
      contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.primary} />}
      ListEmptyComponent={
        <View style={styles.emptyBox}>
          <Text style={styles.emptyIcon}>⚡</Text>
          <Text style={styles.emptyText}>No chargers listed yet</Text>
          <TouchableOpacity style={styles.addBtn} onPress={() => navigation.navigate('ListCharger')}>
            <Text style={styles.addBtnText}>Add your first charger</Text>
          </TouchableOpacity>
        </View>
      }
      renderItem={({ item }) => (
        <View style={styles.card}>
          {/* Thumbnail */}
          {item.charger_photos?.[0]?.url ? (
            <Image source={{ uri: item.charger_photos[0].url }} style={styles.thumb} />
          ) : (
            <View style={[styles.thumb, styles.thumbPlaceholder]}>
              <Text style={{ fontSize: 28 }}>🔌</Text>
            </View>
          )}

          <View style={styles.cardBody}>
            {/* Title + availability toggle */}
            <View style={styles.titleRow}>
              <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
              {togglingId === item.id
                ? <ActivityIndicator size="small" color={colors.primary} />
                : (
                  <Switch
                    value={item.is_available}
                    onValueChange={() => toggleAvailability(item)}
                    trackColor={{ false: colors.cardBorder, true: colors.primaryDim }}
                    thumbColor={item.is_available ? colors.primary : colors.textMuted}
                  />
                )
              }
            </View>

            {/* Status badge */}
            <View style={[styles.badge, { backgroundColor: item.is_available ? colors.primaryDim : '#2a2a2a' }]}>
              <View style={[styles.dot, { backgroundColor: item.is_available ? colors.primary : colors.textMuted }]} />
              <Text style={[styles.badgeText, { color: item.is_available ? colors.primary : colors.textMuted }]}>
                {item.is_available ? 'Live on network' : 'Offline'}
              </Text>
            </View>

            {/* Details */}
            <View style={styles.detailRow}>
              <Text style={styles.detail}>⚡ {item.power_kw} kW</Text>
              <Text style={styles.detail}>₹{item.price_per_kwh}/kWh</Text>
              <Text style={styles.detail}>{item.connector_types?.join(', ') || '—'}</Text>
            </View>

            {item.city ? <Text style={styles.location}>📍 {item.city}</Text> : null}

            {/* Actions */}
            <View style={styles.actions}>
              <TouchableOpacity
                style={styles.editBtn}
                onPress={() => navigation.navigate('EditCharger', { charger: item })}
              >
                <Text style={styles.editBtnText}>Edit Details</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.deleteBtn} onPress={() => confirmDelete(item)}>
                <Text style={styles.deleteBtnText}>Delist</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    />
  );
}

function makeStyles(c) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg },
  center: { flex: 1, backgroundColor: c.bg, justifyContent: 'center', alignItems: 'center' },

  card: {
    backgroundColor: c.card, borderColor: c.cardBorder, borderWidth: 1,
    borderRadius: 16, marginBottom: 14, overflow: 'hidden',
  },
  thumb: { width: '100%', height: 140 },
  thumbPlaceholder: { backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center' },

  cardBody: { padding: 14 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  title: { fontSize: 16, fontWeight: '800', color: c.textPrimary, flex: 1, marginRight: 8 },

  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5,
    alignSelf: 'flex-start', marginBottom: 10,
  },
  dot: { width: 7, height: 7, borderRadius: 4 },
  badgeText: { fontSize: 12, fontWeight: '600' },

  detailRow: { flexDirection: 'row', gap: 12, marginBottom: 4 },
  detail: { fontSize: 13, color: c.textSecondary, fontWeight: '500' },
  location: { fontSize: 12, color: c.textMuted, marginBottom: 12 },

  actions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  editBtn: {
    flex: 1, backgroundColor: c.primaryDim, borderColor: c.primary,
    borderWidth: 1, borderRadius: 10, paddingVertical: 10, alignItems: 'center',
  },
  editBtnText: { color: c.primary, fontWeight: '700', fontSize: 14 },
  deleteBtn: {
    backgroundColor: '#2a1a1a', borderColor: c.danger + '66',
    borderWidth: 1, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 18, alignItems: 'center',
  },
  deleteBtnText: { color: c.danger, fontWeight: '700', fontSize: 14 },

  emptyBox: { alignItems: 'center', paddingTop: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { color: c.textSecondary, fontSize: 15, fontWeight: '600', marginBottom: 20 },
  addBtn: { backgroundColor: c.primary, borderRadius: 12, paddingVertical: 13, paddingHorizontal: 28 },
  addBtnText: { color: '#000', fontWeight: '800', fontSize: 15 },
});
}
