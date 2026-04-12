import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert,
  ActivityIndicator, ScrollView, TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { apiGetBooking, apiEndSession } from '../api/bookings';
import { useAuthStore } from '../store/authStore';
import { colors } from '../constants/colors';

export default function ActiveSessionScreen({ route, navigation }) {
  const { bookingId } = route.params;
  const { user } = useAuthStore();

  const [booking, setBooking] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef(null);

  // End session (host only)
  const [showEndForm, setShowEndForm] = useState(false);
  const [unitsKwh, setUnitsKwh] = useState('');
  const [ending, setEnding] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadBooking();
      return () => clearInterval(timerRef.current);
    }, [bookingId])
  );

  async function loadBooking() {
    try {
      const { data } = await apiGetBooking(bookingId);
      const b = data.booking;
      setBooking(b);

      clearInterval(timerRef.current);

      const startMs = b.session?.started_at
        ? new Date(b.session.started_at).getTime()
        : new Date(b.start_time).getTime();

      const tick = () => setElapsed(Math.floor((Date.now() - startMs) / 1000));
      tick();
      timerRef.current = setInterval(tick, 1000);
    } catch {
      Alert.alert('Error', 'Could not load session');
      navigation.goBack();
    }
  }

  async function handleEndSession() {
    const kwh = parseFloat(unitsKwh);
    if (!kwh || kwh < 0) return Alert.alert('Invalid', 'Enter valid kWh value from your meter');

    Alert.alert(
      'End Session',
      `Confirm ${kwh} kWh delivered?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm & End',
          onPress: async () => {
            setEnding(true);
            try {
              const { data } = await apiEndSession(bookingId, kwh);
              clearInterval(timerRef.current);
              // Reload booking to get updated session data
              const { data: updated } = await apiGetBooking(bookingId);
              navigation.replace('SessionComplete', { booking: updated.booking });
            } catch (err) {
              Alert.alert('Error', err.response?.data?.error || 'Could not end session');
            } finally {
              setEnding(false);
            }
          },
        },
      ]
    );
  }

  function fmt(seconds) {
    if (seconds <= 0) return '0m';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  }

  if (!booking) {
    return <View style={styles.center}><ActivityIndicator color={colors.primary} size="large" /></View>;
  }

  const isHost = booking.host_id === user?.id;
  const pricePerKwh = booking.charger?.price_per_kwh || 10;

  // Time remaining based on original slot duration
  const sessionStartMs = booking.session?.started_at
    ? new Date(booking.session.started_at).getTime()
    : new Date(booking.start_time).getTime();
  const originalDurationMs = new Date(booking.end_time) - new Date(booking.start_time);
  const sessionEndMs = sessionStartMs + originalDurationMs;
  const timeLeft = Math.max(0, Math.floor((sessionEndMs - Date.now()) / 1000));

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.activeDot} />
          <Text style={styles.headerTitle}>Session Active</Text>
        </View>
        <Text style={styles.headerSub} numberOfLines={2}>
          {booking.charger?.title}
          {booking.session?.started_at
            ? ` · Started ${new Date(booking.session.started_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`
            : ''}
        </Text>

        {/* Stats */}
        <View style={styles.statsCard}>
          <StatRow label="Duration" value={fmt(elapsed)} />
          <StatRow label="Time remaining" value={timeLeft > 0 ? fmt(timeLeft) : 'Slot time over'} />
          <StatRow label="Rate" value={`₹${pricePerKwh}/kWh`} />
        </View>

        {/* USER view */}
        {!isHost && (
          <>
            <View style={styles.otpCard}>
              <Text style={styles.otpLabel}>Your Session OTP</Text>
              <Text style={styles.otpValue}>{booking.otp || '••••'}</Text>
              <Text style={styles.otpHint}>Host needs this OTP to end the session</Text>
            </View>
            <View style={styles.infoBox}>
              <Text style={styles.infoText}>
                To end the session early, inform the host directly. They will record the actual kWh delivered and end the session from their side.
              </Text>
            </View>
          </>
        )}

        {/* HOST view */}
        {isHost && !showEndForm && (
          <TouchableOpacity style={styles.endBtn} onPress={() => setShowEndForm(true)}>
            <Text style={styles.endBtnText}>🔌 End Session Early</Text>
          </TouchableOpacity>
        )}

        {isHost && showEndForm && (
          <View style={styles.endForm}>
            <Text style={styles.endFormTitle}>Record kWh Delivered</Text>
            <Text style={styles.endFormSub}>
              Check your charger meter and enter the actual units delivered.
            </Text>
            <TextInput
              style={styles.kwhInput}
              value={unitsKwh}
              onChangeText={setUnitsKwh}
              placeholder="e.g. 4.5"
              placeholderTextColor={colors.textMuted}
              keyboardType="decimal-pad"
            />
            <TouchableOpacity
              style={[styles.confirmEndBtn, ending && { opacity: 0.6 }]}
              onPress={handleEndSession}
              disabled={ending}
            >
              {ending
                ? <ActivityIndicator color="#000" />
                : <Text style={styles.confirmEndBtnText}>Confirm & End Session</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelEndBtn} onPress={() => setShowEndForm(false)}>
              <Text style={styles.cancelEndBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function StatRow({ label, value, highlight }) {
  return (
    <View style={styles.statRow}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, highlight && { color: colors.primary }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 20, paddingBottom: 50 },
  center: { flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' },

  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  activeDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary, marginRight: 8 },
  headerTitle: { fontSize: 22, fontWeight: '800', color: colors.textPrimary },
  headerSub: { fontSize: 13, color: colors.textSecondary, marginBottom: 20, lineHeight: 18 },

  statsCard: {
    backgroundColor: colors.card, borderColor: colors.cardBorder, borderWidth: 1,
    borderRadius: 14, overflow: 'hidden', marginBottom: 14,
  },
  statRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 13,
    borderBottomWidth: 1, borderBottomColor: colors.cardBorder,
  },
  statLabel: { color: colors.textSecondary, fontSize: 14 },
  statValue: { color: colors.textPrimary, fontWeight: '700', fontSize: 14 },

  otpCard: {
    backgroundColor: colors.card, borderColor: colors.cardBorder, borderWidth: 1,
    borderRadius: 14, padding: 16, alignItems: 'center', marginBottom: 12,
  },
  otpLabel: { fontSize: 11, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 },
  otpValue: { fontSize: 36, fontWeight: '900', color: colors.textPrimary, letterSpacing: 8, marginBottom: 4 },
  otpHint: { fontSize: 12, color: colors.textMuted, textAlign: 'center' },

  infoBox: {
    backgroundColor: colors.surface, borderRadius: 12, padding: 14,
  },
  infoText: { color: colors.textSecondary, fontSize: 13, lineHeight: 20 },

  endBtn: {
    backgroundColor: '#29B6F6', borderRadius: 14,
    paddingVertical: 15, alignItems: 'center',
  },
  endBtnText: { color: '#000', fontWeight: '800', fontSize: 15 },

  endForm: {
    backgroundColor: colors.card, borderColor: '#29B6F6', borderWidth: 1.5,
    borderRadius: 16, padding: 20,
  },
  endFormTitle: { fontSize: 16, fontWeight: '800', color: colors.textPrimary, marginBottom: 6, textAlign: 'center' },
  endFormSub: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', marginBottom: 16, lineHeight: 20 },
  kwhInput: {
    backgroundColor: colors.surface, borderColor: colors.cardBorder, borderWidth: 1,
    borderRadius: 12, color: colors.textPrimary, fontSize: 24, fontWeight: '700',
    paddingVertical: 12, paddingHorizontal: 16, marginBottom: 14, textAlign: 'center',
  },
  confirmEndBtn: {
    backgroundColor: '#29B6F6', borderRadius: 12,
    paddingVertical: 14, alignItems: 'center', marginBottom: 10,
  },
  confirmEndBtnText: { color: '#000', fontWeight: '800', fontSize: 15 },
  cancelEndBtn: { paddingVertical: 10, alignItems: 'center' },
  cancelEndBtnText: { color: colors.textMuted, fontSize: 14 },
});
