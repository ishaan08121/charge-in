import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator, RefreshControl,
} from 'react-native';
import client from '../../api/client';
import { colors } from '../../constants/colors';

export default function EarningsScreen() {
  const [earnings, setEarnings] = useState(null);
  const [payouts, setPayouts] = useState([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const [eRes, pRes] = await Promise.all([
        client.get('/payouts/earnings'),
        client.get('/payouts'),
      ]);
      setEarnings(eRes.data);
      setPayouts(pRes.data.payouts);
    } catch (e) {
      // silently fail
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  if (loading && !earnings) {
    return <View style={styles.center}><ActivityIndicator color={colors.primary} size="large" /></View>;
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ padding: 20 }}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.primary} />}
    >
      <Text style={styles.heading}>Earnings</Text>

      {/* Summary cards */}
      <View style={styles.statsRow}>
        <StatCard label="Total Earned" value={`₹${earnings?.total_earnings_inr || '0.00'}`} highlight />
        <StatCard label="Paid Out" value={`₹${earnings?.paid_inr || '0.00'}`} />
        <StatCard label="Pending" value={`₹${earnings?.pending_inr || '0.00'}`} warn />
      </View>

      {/* Payout note */}
      {parseFloat(earnings?.pending_inr || 0) > 0 && (
        <View style={styles.pendingNote}>
          <Text style={styles.pendingNoteText}>
            ₹{earnings.pending_inr} pending — Razorpay X UPI payouts will be available after KYC activation.
          </Text>
        </View>
      )}

      {/* Transaction list */}
      <Text style={styles.sectionLabel}>Transaction History</Text>
      {payouts.length === 0 && (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyIcon}>💳</Text>
          <Text style={styles.empty}>No transactions yet</Text>
          <Text style={styles.emptySub}>Complete sessions to start earning</Text>
        </View>
      )}
      {payouts.map((p) => (
        <View key={p.id} style={styles.txCard}>
          <View style={styles.txLeft}>
            <Text style={styles.txDate}>
              {new Date(p.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            </Text>
            <Text style={styles.txSub}>Session earnings</Text>
          </View>
          <View style={styles.txRight}>
            <Text style={styles.txAmount}>₹{(p.amount / 100).toFixed(2)}</Text>
            <View style={[styles.txBadge, { backgroundColor: statusColor(p.status) + '22' }]}>
              <Text style={[styles.txBadgeText, { color: statusColor(p.status) }]}>
                {p.status.toUpperCase()}
              </Text>
            </View>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

function statusColor(status) {
  return status === 'paid' ? colors.primary : status === 'processing' ? '#29B6F6' : status === 'failed' ? colors.danger : '#FFA726';
}

function StatCard({ label, value, highlight, warn }) {
  return (
    <View style={[styles.statCard, highlight && styles.statCardHighlight]}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, highlight && { color: colors.primary }, warn && { color: '#FFA726' }]}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' },
  heading: { fontSize: 22, fontWeight: '800', color: colors.textPrimary, marginBottom: 20 },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  statCard: { flex: 1, backgroundColor: colors.card, borderColor: colors.cardBorder, borderWidth: 1, borderRadius: 14, padding: 14 },
  statCardHighlight: { borderColor: colors.primary, backgroundColor: colors.primaryDim },
  statLabel: { fontSize: 11, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  statValue: { fontSize: 18, fontWeight: '800', color: colors.textPrimary },
  pendingNote: { backgroundColor: '#FFA72622', borderColor: '#FFA726', borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 20 },
  pendingNoteText: { color: '#FFA726', fontSize: 13, lineHeight: 18 },
  sectionLabel: { fontSize: 13, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 },
  txCard: { backgroundColor: colors.card, borderColor: colors.cardBorder, borderWidth: 1, borderRadius: 12, padding: 14, marginBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  txLeft: {},
  txDate: { fontSize: 14, fontWeight: '600', color: colors.textPrimary, marginBottom: 3 },
  txSub: { fontSize: 12, color: colors.textMuted },
  txRight: { alignItems: 'flex-end', gap: 6 },
  txAmount: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  txBadge: { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2 },
  txBadgeText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  emptyBox: { alignItems: 'center', paddingTop: 32 },
  emptyIcon: { fontSize: 36, marginBottom: 10 },
  empty: { color: colors.textSecondary, fontSize: 15, fontWeight: '600', marginBottom: 4 },
  emptySub: { color: colors.textMuted, fontSize: 13 },
});
