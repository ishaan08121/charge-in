import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Alert, ActivityIndicator, TextInput,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { apiGetBooking, apiCancelBooking, apiStartSession } from '../api/bookings';
import { apiGetUser } from '../api/users';
import { useAuthStore } from '../store/authStore';
import { useColors } from '../constants/colors';

const STATUS_COLOR = {
  pending:   '#FFA726',
  confirmed: '#00c853',
  active:    '#29B6F6',
  completed: '#999999',
  cancelled: '#ef5350',
  declined: '#ef5350',
};

const STATUS_LABEL = {
  pending:   '⏳ Waiting for host confirmation',
  confirmed: '✅ Confirmed',
  active:    '⚡ Charging in progress',
  completed: '✓ Completed',
  cancelled: '✕ Cancelled',
  declined:  '✕ Declined by host',
};

export default function BookingDetailScreen({ route, navigation }) {
  const colors = useColors();
  const styles = makeStyles(colors);
  const { bookingId } = route.params;
  const { user } = useAuthStore();

  const [booking, setBooking] = useState(null);
  const [bookerUser, setBookerUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [otpInput, setOtpInput] = useState('');
  const [starting, setStarting] = useState(false);

  // Refresh every time this screen comes into focus
  useFocusEffect(
    useCallback(() => {
      let active = true;
      async function load() {
        try {
          const { data } = await apiGetBooking(bookingId);
          if (active) {
            setBooking(data.booking);
            // Fetch booker details for host view
            if (data.booking.user_id && data.booking.host_id === user?.id) {
              try {
                const { data: ud } = await apiGetUser(data.booking.user_id);
                setBookerUser(ud.user);
              } catch {}
            }
          }
        } catch {
          Alert.alert('Error', 'Could not load booking');
          navigation.goBack();
        } finally {
          if (active) setLoading(false);
        }
      }
      load();
      return () => { active = false; };
    }, [bookingId])
  );

  async function handleCancel() {
    Alert.alert('Cancel Booking', 'Are you sure? Refund policy applies.', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Yes, Cancel', style: 'destructive',
        onPress: async () => {
          setCancelling(true);
          try {
            await apiCancelBooking(bookingId);
            Alert.alert('Cancelled', 'Your booking has been cancelled.', [
              { text: 'OK', onPress: () => navigation.goBack() },
            ]);
          } catch (err) {
            Alert.alert('Error', err.response?.data?.error || 'Could not cancel');
          } finally {
            setCancelling(false);
          }
        },
      },
    ]);
  }

  async function handleStartSession() {
    if (otpInput.length < 4) {
      return Alert.alert('Enter OTP', 'Ask the user for their 4-digit OTP');
    }
    setStarting(true);
    try {
      await apiStartSession(bookingId, otpInput);
      navigation.replace('ActiveSession', { bookingId });
    } catch (err) {
      Alert.alert('Invalid OTP', err.response?.data?.error || 'OTP did not match. Ask the user to check their OTP.');
    } finally {
      setStarting(false);
    }
  }

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={colors.primary} size="large" /></View>;
  }
  if (!booking) return null;

  const isHost = booking.host_id === user?.id;
  const start = new Date(booking.start_time);
  const end = new Date(booking.end_time);
  const canCancel = !isHost && ['pending', 'confirmed'].includes(booking.status);

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

      {/* Role badge */}
      <View style={styles.roleBadge}>
        <Text style={styles.roleBadgeText}>{isHost ? '🔌 You are the Host' : '🚗 Your Booking'}</Text>
      </View>

      {/* Status */}
      <View style={[styles.statusBox, {
        backgroundColor: (STATUS_COLOR[booking.status] || colors.textMuted) + '18',
        borderColor: (STATUS_COLOR[booking.status] || colors.textMuted) + '44',
      }]}>
        <Text style={[styles.statusText, { color: STATUS_COLOR[booking.status] || colors.textMuted }]}>
          {STATUS_LABEL[booking.status] || booking.status}
        </Text>
      </View>

      {/* Booking details */}
      <View style={styles.card}>
        <Row label="Charger" value={booking.charger?.title || '—'} />
        <Row label="Location" value={booking.charger?.city || booking.charger?.address || '—'} />
        <Row label="Date" value={start.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })} />
        <Row label="Start" value={start.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} />
        <Row label="End" value={end.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} />
        <Row label="Amount" value={`₹${((booking.amount_held || 0) / 100).toFixed(0)}`} last={!isHost || !bookerUser} />
        {isHost && bookerUser && (
          <>
            <Row label="Booked by" value={bookerUser.full_name || '—'} />
            <Row label="Phone" value={bookerUser.phone || '—'} last />
          </>
        )}
      </View>

      {/* ── USER: Show OTP ── */}
      {!isHost && ['pending', 'confirmed'].includes(booking.status) && booking.otp && (
        <View style={styles.otpBox}>
          <Text style={styles.otpLabel}>Session OTP</Text>
          <Text style={styles.otp}>{booking.otp}</Text>
          <Text style={styles.otpHint}>
            {booking.status === 'confirmed'
              ? 'Show this to the host when you arrive — they will enter it to start charging'
              : 'Save this OTP — you will need it once the host confirms your booking'}
          </Text>
        </View>
      )}

      {/* ── USER: Cancel button ── */}
      {canCancel && (
        <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel} disabled={cancelling}>
          {cancelling
            ? <ActivityIndicator color={colors.danger} />
            : <Text style={styles.cancelBtnText}>Cancel Booking</Text>}
        </TouchableOpacity>
      )}

      {/* ── HOST: Pending — redirect to requests ── */}
      {isHost && booking.status === 'pending' && (
        <View style={styles.hostBox}>
          <Text style={styles.hostBoxText}>This booking is awaiting your response.</Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => navigation.navigate('BookingRequests')}>
            <Text style={styles.primaryBtnText}>Go to Booking Requests →</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── HOST: Confirmed — OTP entry to start session ── */}
      {isHost && booking.status === 'confirmed' && (
        <View style={styles.startBox}>
          <Text style={styles.startTitle}>Start Charging Session</Text>
          <Text style={styles.startSub}>
            Ask the user to show their OTP and enter it below to start charging.
          </Text>
          <TextInput
            style={styles.otpInput}
            value={otpInput}
            onChangeText={setOtpInput}
            placeholder="_ _ _ _"
            placeholderTextColor={colors.textMuted}
            keyboardType="number-pad"
            maxLength={4}
          />
          <TouchableOpacity
            style={[styles.primaryBtn, (!otpInput || starting) && styles.primaryBtnDisabled]}
            onPress={handleStartSession}
            disabled={starting || !otpInput}
          >
            {starting
              ? <ActivityIndicator color="#000" />
              : <Text style={styles.primaryBtnText}>⚡ Start Session</Text>}
          </TouchableOpacity>
        </View>
      )}

      {/* ── HOST: Active — go to live session ── */}
      {isHost && booking.status === 'active' && (
        <TouchableOpacity style={styles.primaryBtn} onPress={() => navigation.navigate('ActiveSession', { bookingId })}>
          <Text style={styles.primaryBtnText}>⚡ View Live Session →</Text>
        </TouchableOpacity>
      )}

      {/* Refund info */}
      {['declined', 'cancelled'].includes(booking.status) && (
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            {booking.status === 'declined'
              ? 'Your booking was declined. A full refund will be processed within 5-7 business days.'
              : 'Refund (if applicable) will be processed within 5-7 business days.'}
          </Text>
        </View>
      )}

    </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Row({ label, value, last }) {
  const colors = useColors();
  const styles = makeStyles(colors);
  return (
    <View style={[styles.row, !last && styles.rowBorder]}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue} numberOfLines={2}>{value}</Text>
    </View>
  );
}

function makeStyles(c) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg },
  content: { padding: 20, paddingBottom: 50 },
  center: { flex: 1, backgroundColor: c.bg, justifyContent: 'center', alignItems: 'center' },

  roleBadge: {
    backgroundColor: c.card, borderColor: c.cardBorder, borderWidth: 1,
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6,
    alignSelf: 'flex-start', marginBottom: 14,
  },
  roleBadgeText: { color: c.textSecondary, fontSize: 13, fontWeight: '600' },

  statusBox: {
    borderWidth: 1, borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 13, marginBottom: 20,
  },
  statusText: { fontSize: 15, fontWeight: '700', textAlign: 'center' },

  card: {
    backgroundColor: c.card, borderColor: c.cardBorder,
    borderWidth: 1, borderRadius: 14, marginBottom: 20, overflow: 'hidden',
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 13 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: c.cardBorder },
  rowLabel: { color: c.textMuted, fontSize: 13 },
  rowValue: { color: c.textPrimary, fontSize: 13, fontWeight: '600', maxWidth: '60%', textAlign: 'right' },

  otpBox: {
    backgroundColor: c.card, borderColor: c.primary, borderWidth: 1.5,
    borderRadius: 16, padding: 20, alignItems: 'center', marginBottom: 20,
  },
  otpLabel: { fontSize: 11, color: c.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
  otp: { fontSize: 52, fontWeight: '900', color: c.primary, letterSpacing: 10, marginBottom: 8 },
  otpHint: { fontSize: 12, color: c.textSecondary, textAlign: 'center', lineHeight: 18 },

  cancelBtn: {
    borderColor: c.danger, borderWidth: 1, borderRadius: 14,
    paddingVertical: 15, alignItems: 'center',
  },
  cancelBtnText: { color: c.danger, fontWeight: '700', fontSize: 15 },

  hostBox: {
    backgroundColor: c.card, borderColor: c.cardBorder, borderWidth: 1,
    borderRadius: 14, padding: 18,
  },
  hostBoxText: { color: c.textSecondary, fontSize: 14, textAlign: 'center', marginBottom: 16 },

  startBox: {
    backgroundColor: c.card, borderColor: c.primary + '55', borderWidth: 1.5,
    borderRadius: 16, padding: 20,
  },
  startTitle: { fontSize: 17, fontWeight: '800', color: c.textPrimary, textAlign: 'center', marginBottom: 8 },
  startSub: { fontSize: 13, color: c.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: 20 },
  otpInput: {
    backgroundColor: c.surface, borderColor: c.primary, borderWidth: 1.5,
    borderRadius: 14, color: c.primary, fontSize: 36, fontWeight: '900',
    paddingVertical: 14, paddingHorizontal: 20, marginBottom: 16,
    letterSpacing: 14, textAlign: 'center',
  },

  primaryBtn: {
    backgroundColor: c.primary, borderRadius: 14,
    paddingVertical: 15, alignItems: 'center',
  },
  primaryBtnDisabled: { opacity: 0.4 },
  primaryBtnText: { color: '#000', fontWeight: '800', fontSize: 15 },

  infoBox: {
    backgroundColor: c.card, borderColor: c.cardBorder, borderWidth: 1,
    borderRadius: 12, padding: 16,
  },
  infoText: { color: c.textSecondary, fontSize: 13, textAlign: 'center', lineHeight: 20 },
});
}
