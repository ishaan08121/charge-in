import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList,
  ActivityIndicator, TouchableOpacity, RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { apiGetBookings } from '../api/bookings';
import { colors } from '../constants/colors';

const STATUS_COLOR = {
  pending:   '#FFA726',
  confirmed: colors.primary,
  active:    '#29B6F6',
  completed: colors.textSecondary,
  cancelled: colors.danger,
  declined:  colors.danger,
};

const STATUS_LABEL = {
  pending:   'Waiting for host',
  confirmed: 'Confirmed ✓',
  active:    '⚡ Charging now',
  completed: 'Completed',
  cancelled: 'Cancelled',
  declined:  'Declined',
};

const ACTIVE_STATUSES = ['pending', 'confirmed', 'active'];
const HISTORY_STATUSES = ['completed', 'cancelled', 'declined'];

export default function BookingsScreen({ navigation }) {
  const [tab, setTab] = useState('active'); // 'active' | 'history'
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  // Refresh every time screen is focused
  useFocusEffect(
    useCallback(() => {
      load();
    }, [])
  );

  async function load() {
    setLoading(true);
    try {
      // Always fetch both — host flag may not be set in authStore
      const promises = [apiGetBookings('user'), apiGetBookings('host')];

      const results = await Promise.all(promises);
      const userBookings = results[0].data.bookings || [];
      const hostBookings = results[1]?.data?.bookings || [];

      // Merge, deduplicate by id
      const merged = [...userBookings];
      hostBookings.forEach(hb => {
        if (!merged.find(b => b.id === hb.id)) merged.push(hb);
      });

      // Sort newest first
      merged.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      setBookings(merged);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }

  const activeBookings = bookings.filter(b => ACTIVE_STATUSES.includes(b.status));
  const historyBookings = bookings.filter(b => HISTORY_STATUSES.includes(b.status));
  const displayedBookings = tab === 'active' ? activeBookings : historyBookings;

  function handlePress(item) {
    if (item.status === 'active') {
      navigation.navigate('ActiveSession', { bookingId: item.id });
    } else if (item.status === 'completed') {
      navigation.navigate('SessionComplete', { booking: item });
    } else {
      navigation.navigate('BookingDetail', { bookingId: item.id });
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>My Bookings</Text>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, tab === 'active' && styles.tabActive]}
          onPress={() => setTab('active')}
        >
          <Text style={[styles.tabText, tab === 'active' && styles.tabTextActive]}>
            Active
            {activeBookings.length > 0 && (
              <Text style={styles.tabCount}> {activeBookings.length}</Text>
            )}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'history' && styles.tabActive]}
          onPress={() => setTab('history')}
        >
          <Text style={[styles.tabText, tab === 'history' && styles.tabTextActive]}>History</Text>
        </TouchableOpacity>
      </View>

      {loading && !bookings.length ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={displayedBookings}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.primary} />
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.card, item.status === 'active' && styles.cardActive]}
              onPress={() => handlePress(item)}
              activeOpacity={0.75}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.chargerTitle} numberOfLines={1}>
                  {item.charger?.title || 'Charger'}
                </Text>
                <View style={[styles.badge, { backgroundColor: (STATUS_COLOR[item.status] || colors.textMuted) + '22' }]}>
                  <Text style={[styles.badgeText, { color: STATUS_COLOR[item.status] || colors.textMuted }]}>
                    {(item.status || '').toUpperCase()}
                  </Text>
                </View>
              </View>

              <Text style={styles.statusLabel}>{STATUS_LABEL[item.status] || item.status}</Text>
              <Text style={styles.location}>{item.charger?.city || item.charger?.address || ''}</Text>
              <Text style={styles.time}>
                {new Date(item.start_time).toLocaleString('en-IN', {
                  weekday: 'short', day: 'numeric', month: 'short',
                  hour: '2-digit', minute: '2-digit',
                })}
              </Text>

              {item.status === 'active' && (
                <View style={styles.activeChip}>
                  <Text style={styles.activeChipText}>Tap to view live session →</Text>
                </View>
              )}

              {item.status === 'completed' && item.session?.final_amount && (
                <Text style={styles.amountText}>
                  Paid ₹{(item.session.final_amount / 100).toFixed(0)} · {item.session.units_kwh} kWh
                </Text>
              )}
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            !loading && (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyIcon}>{tab === 'active' ? '📋' : '🕐'}</Text>
                <Text style={styles.empty}>
                  {tab === 'active' ? 'No active bookings' : 'No booking history yet'}
                </Text>
                <Text style={styles.emptySub}>
                  {tab === 'active'
                    ? 'Find a charger on the map to get started'
                    : 'Completed and cancelled bookings will appear here'}
                </Text>
              </View>
            )
          }
          contentContainerStyle={{ padding: 16, paddingTop: 0, paddingBottom: 30 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  heading: { fontSize: 22, fontWeight: '800', color: colors.textPrimary, padding: 20, paddingBottom: 12 },

  tabs: {
    flexDirection: 'row', marginHorizontal: 16, marginBottom: 12,
    backgroundColor: colors.card, borderRadius: 12,
    borderWidth: 1, borderColor: colors.cardBorder, padding: 4,
  },
  tab: { flex: 1, paddingVertical: 9, borderRadius: 9, alignItems: 'center' },
  tabActive: { backgroundColor: colors.primary },
  tabText: { color: colors.textMuted, fontWeight: '600', fontSize: 14 },
  tabTextActive: { color: '#000', fontWeight: '800' },
  tabCount: { fontWeight: '900' },

  card: {
    backgroundColor: colors.card, borderColor: colors.cardBorder, borderWidth: 1,
    borderRadius: 14, padding: 16, marginBottom: 10,
  },
  cardActive: { borderColor: '#29B6F6', backgroundColor: '#0a1a2a' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
  chargerTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary, flex: 1, marginRight: 8 },
  badge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  badgeText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  statusLabel: { fontSize: 13, color: colors.textSecondary, marginBottom: 4, fontWeight: '500' },
  location: { fontSize: 12, color: colors.textMuted, marginBottom: 2 },
  time: { fontSize: 12, color: colors.textMuted },
  activeChip: {
    marginTop: 10, backgroundColor: '#29B6F622', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 6,
  },
  activeChipText: { color: '#29B6F6', fontSize: 12, fontWeight: '600' },
  amountText: { fontSize: 12, color: colors.primary, marginTop: 6, fontWeight: '600' },

  emptyBox: { alignItems: 'center', paddingTop: 48 },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  empty: { color: colors.textSecondary, fontSize: 15, fontWeight: '600', marginBottom: 4 },
  emptySub: { color: colors.textMuted, fontSize: 13, textAlign: 'center', paddingHorizontal: 20 },
});
