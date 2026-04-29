import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Alert, ActivityIndicator, RefreshControl, Modal, TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import { apiGetBookings, apiRespondBooking, apiStartSession, apiEndSession } from '../../api/bookings';
import { apiGetUser, apiGetUserRating } from '../../api/users';
import { useColors } from '../../constants/colors';

const STATUS_COLOR = {
  pending: '#FFA726',
  confirmed: '#00c853',
  active: '#29B6F6',
  completed: '#999999',
  cancelled: '#ef5350',
  declined: '#ef5350',
};

export default function BookingRequestsScreen({ navigation }) {
  const colors = useColors();
  const styles = makeStyles(colors);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [otpModal, setOtpModal] = useState({ visible: false, bookingId: null });
  const [kwhModal, setKwhModal] = useState({ visible: false, bookingId: null });
  const [inputText, setInputText] = useState('');
  const pendingBookingId = React.useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await apiGetBookings('host');
      const bookingsData = data.bookings || [];

      // Fetch user details for each unique user_id
      const uniqueUserIds = [...new Set(bookingsData.map(b => b.user_id).filter(Boolean))];
      const userMap = {};
      const ratingMap = {};
      await Promise.all(uniqueUserIds.map(async (uid) => {
        try {
          const [{ data: ud }, { data: rd }] = await Promise.all([
            apiGetUser(uid),
            apiGetUserRating(uid),
          ]);
          userMap[uid] = ud.user;
          ratingMap[uid] = rd;
        } catch {
          // silent
        }
      }));

      setBookings(bookingsData.map(b => ({
        ...b,
        user: userMap[b.user_id] || null,
        clientRating: ratingMap[b.user_id] || null,
      })));
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

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
              const newStatus = action === 'accept' ? 'confirmed' : 'declined';
              setBookings(prev => prev.map(b => b.id === bookingId ? { ...b, status: newStatus } : b));
              Alert.alert('Success', action === 'accept' ? 'Booking accepted!' : 'Booking declined');
            } catch (err) {
              const msg = err.response?.data?.error || err.message || 'Failed';
              Alert.alert('Error', msg);
            }
          },
        },
      ]
    );
  }

  function handleStartSession(bookingId) {
    pendingBookingId.current = bookingId;
    setInputText('');
    setOtpModal({ visible: true, bookingId });
  }

  async function submitOtp() {
    if (!inputText || inputText.length !== 4) {
      Alert.alert('Invalid OTP', 'Please enter the 4-digit OTP from the user');
      return;
    }
    const bookingId = pendingBookingId.current;
    setOtpModal({ visible: false, bookingId: null });
    try {
      await apiStartSession(bookingId, inputText);
      Alert.alert('Session Started', 'Charging session has begun!');
      load();
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || 'Invalid OTP');
    }
  }

  function handleEndSession(bookingId) {
    pendingBookingId.current = bookingId;
    setInputText('');
    setKwhModal({ visible: true, bookingId });
  }

  async function submitKwh() {
    const kwh = parseFloat(inputText);
    if (isNaN(kwh) || kwh < 0) {
      Alert.alert('Invalid Value', 'Please enter a valid kWh amount');
      return;
    }
    const bookingId = pendingBookingId.current;
    setKwhModal({ visible: false, bookingId: null });
    try {
      const { data } = await apiEndSession(bookingId, kwh);
      Alert.alert('Session Ended', `Final amount: ₹${data.final_amount_inr}`);
      load();
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || 'Failed to end session');
    }
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

        {/* User details */}
        <View style={styles.userRow}>
          <Text style={styles.userIcon}>👤</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.userName}>{item.user?.full_name || 'Unknown User'}</Text>
            {item.user?.phone && <Text style={styles.userPhone}>{item.user.phone}</Text>}
          </View>
          {item.clientRating?.average_rating && (
            <View style={styles.ratingBadge}>
              <Text style={styles.ratingText}>★ {item.clientRating.average_rating}</Text>
              <Text style={styles.ratingCount}> ({item.clientRating.total})</Text>
            </View>
          )}
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
      {loading && !bookings.length && <ActivityIndicator color={colors.primary} style={{ marginTop: 20 }} />}

      {/* OTP Modal */}
      <Modal visible={otpModal.visible} transparent animationType="fade">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Enter User OTP</Text>
            <Text style={styles.modalSub}>Ask the user for their 4-digit OTP</Text>
            <TextInput
              style={styles.modalInput}
              value={inputText}
              onChangeText={setInputText}
              keyboardType="number-pad"
              maxLength={4}
              placeholder="1234"
              placeholderTextColor={colors.textMuted}
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setOtpModal({ visible: false, bookingId: null })}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirmBtn} onPress={submitOtp}>
                <Text style={styles.modalConfirmText}>Start Session</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* kWh Modal */}
      <Modal visible={kwhModal.visible} transparent animationType="fade">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Units Delivered (kWh)</Text>
            <Text style={styles.modalSub}>Enter the kWh reading from your charger meter</Text>
            <TextInput
              style={styles.modalInput}
              value={inputText}
              onChangeText={setInputText}
              keyboardType="decimal-pad"
              placeholder="e.g. 7.5"
              placeholderTextColor={colors.textMuted}
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setKwhModal({ visible: false, bookingId: null })}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalConfirmBtn, { backgroundColor: '#29B6F6' }]} onPress={submitKwh}>
                <Text style={styles.modalConfirmText}>End Session</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <FlatList
        data={bookings}
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

function makeStyles(c) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg },
  card: {
    backgroundColor: c.card, borderColor: c.cardBorder, borderWidth: 1,
    borderRadius: 14, padding: 16, marginBottom: 12,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  chargerTitle: { fontSize: 15, fontWeight: '700', color: c.textPrimary, marginBottom: 4 },
  time: { fontSize: 12, color: c.textSecondary },
  badge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10, padding: 10, backgroundColor: c.bg, borderRadius: 10, flexWrap: 'nowrap' },
  ratingBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFA72622', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  ratingText: { color: '#FFA726', fontWeight: '700', fontSize: 13 },
  ratingCount: { color: c.textMuted, fontSize: 11 },
  userIcon: { fontSize: 20 },
  userName: { color: c.textPrimary, fontWeight: '600', fontSize: 14 },
  userPhone: { color: c.textMuted, fontSize: 12, marginTop: 2 },
  amountRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderTopWidth: 1, borderTopColor: c.cardBorder, marginBottom: 12 },
  amountLabel: { color: c.textMuted, fontSize: 13 },
  amountValue: { color: c.textPrimary, fontWeight: '700', fontSize: 13 },
  actionRow: { flexDirection: 'row' },
  declineBtn: { flex: 1, borderColor: c.danger, borderWidth: 1, borderRadius: 10, paddingVertical: 11, alignItems: 'center', marginRight: 10 },
  declineBtnText: { color: c.danger, fontWeight: '600', fontSize: 14 },
  acceptBtn: { flex: 2, backgroundColor: c.primary, borderRadius: 10, paddingVertical: 11, alignItems: 'center' },
  acceptBtnText: { color: '#000', fontWeight: '700', fontSize: 14 },
  primaryBtn: { backgroundColor: c.primary, borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
  primaryBtnText: { color: '#000', fontWeight: '700', fontSize: 14 },
  emptyBox: { alignItems: 'center', paddingTop: 48 },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  empty: { color: c.textSecondary, fontSize: 15, fontWeight: '600', marginBottom: 4 },
  emptySub: { color: c.textMuted, fontSize: 13 },
  modalOverlay: { flex: 1, backgroundColor: '#00000088', justifyContent: 'center', alignItems: 'center' },
  modalBox: { backgroundColor: c.card, borderRadius: 16, padding: 24, width: '85%', borderWidth: 1, borderColor: c.cardBorder },
  modalTitle: { fontSize: 17, fontWeight: '800', color: c.textPrimary, marginBottom: 6 },
  modalSub: { fontSize: 13, color: c.textMuted, marginBottom: 16 },
  modalInput: {
    borderWidth: 1, borderColor: c.cardBorder, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 22,
    fontWeight: '700', color: c.textPrimary, textAlign: 'center',
    letterSpacing: 8, marginBottom: 20, backgroundColor: c.bg,
  },
  modalActions: { flexDirection: 'row', gap: 10 },
  modalCancelBtn: { flex: 1, borderWidth: 1, borderColor: c.cardBorder, borderRadius: 10, paddingVertical: 11, alignItems: 'center' },
  modalCancelText: { color: c.textSecondary, fontWeight: '600', fontSize: 14 },
  modalConfirmBtn: { flex: 2, backgroundColor: c.primary, borderRadius: 10, paddingVertical: 11, alignItems: 'center' },
  modalConfirmText: { color: '#000', fontWeight: '700', fontSize: 14 },
});
}
