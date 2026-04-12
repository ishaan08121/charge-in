import React, { useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Alert, ActivityIndicator, RefreshControl,
} from 'react-native';
import { apiGetBookings, apiRespondBooking, apiStartSession, apiEndSession } from '../../api/bookings';
import { useBookingStore } from '../../store/bookingStore';
import { colors } from '../../constants/colors';

const STATUS_COLOR = {
  pending: '#FFA726',
  confirmed: colors.primary,
  active: '#29B6F6',
  completed: colors.textSecondary,
  cancelled: colors.danger,
  declined: colors.danger,
};

export default function BookingRequestsScreen({ navigation }) {
  const { bookings, loading, fetchBookings } = useBookingStore();

  // Host view — filter to show host's bookings
  const hostBookings = bookings;

  const load = useCallback(() => fetchBookings('host'), []);
  useEffect(() => { load(); }, []);

  async function respond(bookingId, action) {
    Alert.alert(
      action === 'accept' ? 'Accept Booking' : 'Decline Booking',
      action === 'accept'
        ? 'Confirm this booking and capture payment?'
        : 'Decline and refund the user?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: action === 'accept' ? 'Accept' : 'Decline',
          style: action === 'accept' ? 'default' : 'destructive',
          onPress: async () => {
            try {
              await apiRespondBooking(bookingId, action);
              load();
            } catch (err) {
              Alert.alert('Error', err.response?.data?.error || 'Failed');
            }
          },
        },
      ]
    );
  }

  async function handleStartSession(bookingId) {
    Alert.prompt(
      'Enter User OTP',
      'Ask the user for their 4-digit OTP to start the session',
      async (otp) => {
        try {
          await apiStartSession(bookingId, otp);
          Alert.alert('Session Started', 'Charging session has begun!');
          load();
        } catch (err) {
          Alert.alert('Error', err.response?.data?.error || 'Invalid OTP');
        }
      },
      'plain-text',
      '',
      'number-pad'
    );
  }

  async function handleEndSession(bookingId) {
    Alert.prompt(
      'Units Delivered (kWh)',
      'Enter the kWh delivered from your charger meter',
      async (kwh) => {
        try {
          const { data } = await apiEndSession(bookingId, parseFloat(kwh));
          Alert.alert('Session Ended', `Final amount: ₹${data.final_amount_inr}`);
          load();
        } catch (err) {
          Alert.alert('Error', err.response?.data?.error || 'Failed to end session');
        }
      },
      'plain-text',
      '',
      'decimal-pad'
    );
  }

  function renderItem({ item }) {
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.chargerTitle} numberOfLines={1}>{item.charger?.title || 'Charger'}</Text>
            <Text style={styles.time}>
              {new Date(item.start_time).toLocaleString('en-IN', {
                weekday: 'short', day: 'numeric', month: 'short',
                hour: '2-digit', minute: '2-digit',
              })}
              {' → '}
              {new Date(item.end_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
          <View style={[styles.badge, { backgroundColor: (STATUS_COLOR[item.status] || colors.textMuted) + '22' }]}>
            <Text style={[styles.badgeText, { color: STATUS_COLOR[item.status] || colors.textMuted }]}>
              {item.status.toUpperCase()}
            </Text>
          </View>
        </View>

        <View style={styles.amountRow}>
          <Text style={styles.amountLabel}>Held amount</Text>
          <Text style={styles.amountValue}>₹{((item.amount_held || 0) / 100).toFixed(0)}</Text>
        </View>

        {/* Action buttons based on status */}
        {item.status === 'pending' && (
          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.declineBtn} onPress={() => respond(item.id, 'decline')}>
              <Text style={styles.declineBtnText}>Decline</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.acceptBtn} onPress={() => respond(item.id, 'accept')}>
              <Text style={styles.acceptBtnText}>Accept & Capture</Text>
            </TouchableOpacity>
          </View>
        )}

        {item.status === 'confirmed' && (
          <TouchableOpacity style={styles.primaryBtn} onPress={() => handleStartSession(item.id)}>
            <Text style={styles.primaryBtnText}>⚡ Enter User OTP to Start</Text>
          </TouchableOpacity>
        )}

        {item.status === 'active' && (
          <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: '#29B6F6' }]} onPress={() => handleEndSession(item.id)}>
            <Text style={styles.primaryBtnText}>🔌 End Session & Record Units</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Booking Requests</Text>
      {loading && !hostBookings.length && <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />}
      <FlatList
        data={hostBookings}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.primary} />}
        ListEmptyComponent={
          !loading && (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyIcon}>📭</Text>
              <Text style={styles.empty}>No booking requests yet</Text>
              <Text style={styles.emptySub}>List your charger to start receiving bookings</Text>
            </View>
          )
        }
        contentContainerStyle={{ padding: 16, paddingTop: 0 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  heading: { fontSize: 22, fontWeight: '800', color: colors.textPrimary, padding: 20, paddingBottom: 12 },
  card: {
    backgroundColor: colors.card, borderColor: colors.cardBorder, borderWidth: 1,
    borderRadius: 14, padding: 16, marginBottom: 12,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  chargerTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary, marginBottom: 4 },
  time: { fontSize: 12, color: colors.textSecondary },
  badge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  amountRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.cardBorder, marginBottom: 12 },
  amountLabel: { color: colors.textMuted, fontSize: 13 },
  amountValue: { color: colors.textPrimary, fontWeight: '700', fontSize: 13 },
  actionRow: { flexDirection: 'row' },
  declineBtn: { flex: 1, borderColor: colors.danger, borderWidth: 1, borderRadius: 10, paddingVertical: 11, alignItems: 'center', marginRight: 10 },
  declineBtnText: { color: colors.danger, fontWeight: '600', fontSize: 14 },
  acceptBtn: { flex: 2, backgroundColor: colors.primary, borderRadius: 10, paddingVertical: 11, alignItems: 'center' },
  acceptBtnText: { color: '#000', fontWeight: '700', fontSize: 14 },
  primaryBtn: { backgroundColor: colors.primary, borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
  primaryBtnText: { color: '#000', fontWeight: '700', fontSize: 14 },
  emptyBox: { alignItems: 'center', paddingTop: 48 },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  empty: { color: colors.textSecondary, fontSize: 15, fontWeight: '600', marginBottom: 4 },
  emptySub: { color: colors.textMuted, fontSize: 13 },
});
