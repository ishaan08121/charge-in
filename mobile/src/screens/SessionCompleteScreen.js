import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert,
  ActivityIndicator, ScrollView,
} from 'react-native';
import client from '../api/client';
import { useAuthStore } from '../store/authStore';
import { colors } from '../constants/colors';

export default function SessionCompleteScreen({ route, navigation }) {
  const { booking } = route.params;
  const { user } = useAuthStore();
  const session = booking.session || {};

  const isHost = booking.host_id === user?.id;

  const [rating, setRating] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [reviewed, setReviewed] = useState(false);

  const [clientRating, setClientRating] = useState(0);
  const [clientSubmitting, setClientSubmitting] = useState(false);
  const [clientReviewed, setClientReviewed] = useState(false);

  const unitsKwh = session.units_kwh || 0;
  const finalAmount = session.final_amount || 0;
  const startedAt = session.started_at ? new Date(session.started_at) : new Date(booking.start_time);
  const endedAt = session.ended_at ? new Date(session.ended_at) : new Date(booking.end_time);
  const durationMs = endedAt - startedAt;
  const durationH = Math.floor(durationMs / 3600000);
  const durationM = Math.floor((durationMs % 3600000) / 60000);

  async function submitReview() {
    if (rating === 0) return Alert.alert('Select a rating', 'Tap stars to rate');
    setSubmitting(true);
    try {
      await client.post('/reviews', { booking_id: booking.id, rating });
      setReviewed(true);
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || 'Could not submit review');
    } finally {
      setSubmitting(false);
    }
  }

  async function submitClientRating() {
    if (clientRating === 0) return Alert.alert('Select a rating', 'Tap stars to rate the client');
    setClientSubmitting(true);
    try {
      await client.post('/reviews/client', { booking_id: booking.id, rating: clientRating });
      setClientReviewed(true);
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || 'Could not submit rating');
    } finally {
      setClientSubmitting(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>

      {/* Success icon */}
      <View style={styles.successCircle}>
        <Text style={styles.successIcon}>✓</Text>
      </View>
      <Text style={styles.title}>Session Complete!</Text>
      <Text style={styles.sub}>
        {isHost ? 'Payment has been processed.' : 'Thanks for using Charge.in!'}
      </Text>

      {/* Receipt */}
      <View style={styles.receipt}>
        <Text style={styles.receiptTitle}>Receipt</Text>
        <ReceiptRow label="Units delivered" value={`${unitsKwh} kWh`} />
        <ReceiptRow
          label="Duration"
          value={durationH > 0 ? `${durationH}h ${durationM}m` : `${durationM}m`}
        />
        <ReceiptRow label="Rate" value={`₹${booking.charger?.price_per_kwh || '—'}/kWh`} />
        <View style={styles.receiptDivider} />
        <ReceiptRow
          label={isHost ? 'Amount earned' : 'Total paid'}
          value={`₹${(finalAmount / 100).toFixed(2)}`}
          highlight
        />
      </View>

      {/* Host-only: rate the client */}
      {isHost && (
        clientReviewed ? (
          <View style={styles.reviewedBox}>
            <Text style={styles.reviewedText}>★ Client rated. Thank you!</Text>
          </View>
        ) : (
          <View style={styles.reviewBox}>
            <Text style={styles.reviewTitle}>
              Rate {booking.user?.full_name || 'the client'}
            </Text>
            <Text style={styles.reviewSub}>How was your experience with this EV owner?</Text>
            <View style={styles.starRow}>
              {[1, 2, 3, 4, 5].map((s) => (
                <TouchableOpacity key={s} onPress={() => setClientRating(s)} activeOpacity={0.7}>
                  <Text style={[styles.star, { color: s <= clientRating ? colors.star : colors.cardBorder }]}>★</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity
              style={[styles.reviewBtn, clientRating === 0 && { opacity: 0.4 }]}
              onPress={submitClientRating}
              disabled={clientSubmitting || clientRating === 0}
            >
              {clientSubmitting
                ? <ActivityIndicator color="#000" />
                : <Text style={styles.reviewBtnText}>Submit Rating</Text>}
            </TouchableOpacity>
          </View>
        )
      )}

      {/* User-only: rate the charger */}
      {!isHost && (
        reviewed ? (
          <View style={styles.reviewedBox}>
            <Text style={styles.reviewedText}>★ Review submitted. Thank you!</Text>
          </View>
        ) : (
          <View style={styles.reviewBox}>
            <Text style={styles.reviewTitle}>Rate {booking.charger?.title || 'this charger'}</Text>
            <View style={styles.starRow}>
              {[1, 2, 3, 4, 5].map((s) => (
                <TouchableOpacity key={s} onPress={() => setRating(s)} activeOpacity={0.7}>
                  <Text style={[styles.star, { color: s <= rating ? colors.star : colors.cardBorder }]}>★</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity
              style={[styles.reviewBtn, rating === 0 && { opacity: 0.4 }]}
              onPress={submitReview}
              disabled={submitting || rating === 0}
            >
              {submitting
                ? <ActivityIndicator color="#000" />
                : <Text style={styles.reviewBtnText}>Submit Rating</Text>}
            </TouchableOpacity>
          </View>
        )
      )}

      <TouchableOpacity
        style={styles.doneBtn}
        onPress={() => navigation.popToTop()}
      >
        <Text style={styles.doneBtnText}>Back to Bookings</Text>
      </TouchableOpacity>

    </ScrollView>
  );
}

function ReceiptRow({ label, value, highlight }) {
  return (
    <View style={styles.receiptRow}>
      <Text style={styles.receiptLabel}>{label}</Text>
      <Text style={[styles.receiptValue, highlight && { color: colors.primary, fontSize: 18 }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 24, alignItems: 'center', paddingTop: 40 },

  successCircle: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: colors.primaryDim, borderColor: colors.primary, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center', marginBottom: 14,
  },
  successIcon: { fontSize: 32, color: colors.primary, fontWeight: '800' },
  title: { fontSize: 24, fontWeight: '800', color: colors.textPrimary, marginBottom: 4 },
  sub: { fontSize: 14, color: colors.textSecondary, marginBottom: 24, textAlign: 'center' },

  receipt: {
    backgroundColor: colors.card, borderColor: colors.cardBorder, borderWidth: 1,
    borderRadius: 16, padding: 18, width: '100%', marginBottom: 20,
  },
  receiptTitle: { fontSize: 12, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 },
  receiptRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  receiptLabel: { color: colors.textSecondary, fontSize: 14 },
  receiptValue: { color: colors.textPrimary, fontWeight: '700', fontSize: 14 },
  receiptDivider: { height: 1, backgroundColor: colors.cardBorder, marginVertical: 6 },

  reviewBox: {
    backgroundColor: colors.card, borderColor: colors.cardBorder, borderWidth: 1,
    borderRadius: 16, padding: 18, width: '100%', marginBottom: 16, alignItems: 'center',
  },
  reviewTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary, marginBottom: 4 },
  reviewSub: { fontSize: 12, color: colors.textMuted, marginBottom: 14, textAlign: 'center' },
  starRow: { flexDirection: 'row', marginBottom: 18 },
  star: { fontSize: 42, marginHorizontal: 6 },
  reviewBtn: { backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 13, paddingHorizontal: 32, alignItems: 'center' },
  reviewBtnText: { color: '#000', fontWeight: '700', fontSize: 14 },

  reviewedBox: {
    backgroundColor: colors.primaryDim, borderRadius: 12,
    padding: 14, marginBottom: 16, width: '100%',
  },
  reviewedText: { color: colors.primary, textAlign: 'center', fontWeight: '600', fontSize: 15 },

  doneBtn: {
    borderColor: colors.cardBorder, borderWidth: 1, borderRadius: 14,
    paddingVertical: 14, width: '100%', alignItems: 'center', marginTop: 4,
  },
  doneBtnText: { color: colors.textSecondary, fontWeight: '600', fontSize: 15 },
});
