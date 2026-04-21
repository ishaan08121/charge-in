import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Alert, ActivityIndicator, ScrollView, Platform, Linking,
  Modal, KeyboardAvoidingView,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { apiInitiateBooking, apiConfirmBooking } from '../api/bookings';
import client from '../api/client';
import { useColors } from '../constants/colors';

const DURATIONS = [1, 2, 3, 4, 6, 8];
const MINUTES = [0, 15, 30, 45];

function toDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function hourLabel(h) {
  if (h === 0) return '12AM';
  if (h < 12) return `${h}AM`;
  if (h === 12) return '12PM';
  return `${h - 12}PM`;
}

function formatTime(h, m) {
  const period = h < 12 ? 'AM' : 'PM';
  const displayH = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${displayH}:${String(m).padStart(2, '0')} ${period}`;
}

export default function BookSlotScreen({ route, navigation }) {
  const colors = useColors();
  const styles = makeStyles(colors);
  const { charger, chargerLat, chargerLng } = route.params;

  // Commercial chargers allow 24h; home/society restricted to 6AM-10PM
  const isCommercial = charger.location_type === 'commercial';
  const SLOT_HOURS = isCommercial
    ? Array.from({ length: 24 }, (_, i) => i)
    : Array.from({ length: 17 }, (_, i) => i + 6); // 6 to 22

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dateTabs = [0, 1, 2].map(i => {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    return d;
  });
  const DAY_LABELS = ['Today', 'Tomorrow', dateTabs[2].toLocaleDateString('en-IN', { weekday: 'short' })];

  const [dateIdx, setDateIdx] = useState(0);
  const [startHour, setStartHour] = useState(null);
  const [startMinute, setStartMinute] = useState(0);
  const [duration, setDuration] = useState(2);
  const [bookedSlots, setBookedSlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [loading, setLoading] = useState(false);

  // Custom time picker state
  const [showCustomPicker, setShowCustomPicker] = useState(false);
  const [customTime, setCustomTime] = useState(new Date());
  const [usingCustomTime, setUsingCustomTime] = useState(false);

  const selDate = dateTabs[dateIdx];

  const loadSlots = useCallback(async () => {
    setSlotsLoading(true);
    setStartHour(null);
    setUsingCustomTime(false);
    try {
      const { data } = await client.get(`/chargers/${charger.id}/slots`, {
        params: { date: toDateStr(selDate) },
      });
      setBookedSlots(data.booked_slots || []);
    } catch {
      setBookedSlots([]);
    } finally {
      setSlotsLoading(false);
    }
  }, [dateIdx]);

  useEffect(() => { loadSlots(); }, [loadSlots]);

  function isBooked(h, m = 0) {
    const sStart = new Date(selDate);
    sStart.setHours(h, m, 0, 0);
    const sEnd = new Date(sStart.getTime() + 3600000);
    return bookedSlots.some(b => new Date(b.start_time) < sEnd && new Date(b.end_time) > sStart);
  }

  function isPast(h, m = 0) {
    if (dateIdx !== 0) return false;
    const slotTime = new Date(selDate);
    slotTime.setHours(h, m, 0, 0);
    return slotTime <= new Date();
  }

  function onCustomTimeChange(event, selected) {
    if (Platform.OS === 'android') setShowCustomPicker(false);
    if (selected) {
      setCustomTime(selected);
      if (event.type !== 'dismissed') {
        const h = selected.getHours();
        const rawMin = selected.getMinutes();
        // Round to nearest 15 min
        const m = Math.round(rawMin / 15) * 15 % 60;
        const adjustedH = rawMin >= 53 ? (h + 1) % 24 : h;

        // Check residential restriction
        if (!isCommercial && (adjustedH < 6 || adjustedH >= 22)) {
          Alert.alert(
            'Restricted Hours',
            'This is a home/society charger. Bookings only allowed between 6AM and 10PM.',
          );
          return;
        }
        setStartHour(adjustedH);
        setStartMinute(m);
        setUsingCustomTime(true);
      }
    }
  }

  const effectiveHour = startHour;
  const effectiveMinute = usingCustomTime ? startMinute : 0;

  const startTime = effectiveHour !== null
    ? (() => { const d = new Date(selDate); d.setHours(effectiveHour, effectiveMinute, 0, 0); return d; })()
    : null;
  const endTime = startTime
    ? new Date(startTime.getTime() + duration * 3600000)
    : null;

  const hasConflict = effectiveHour !== null &&
    Array.from({ length: duration }, (_, i) => {
      const totalMins = effectiveHour * 60 + effectiveMinute + i * 60;
      return { h: Math.floor(totalMins / 60) % 24, m: totalMins % 60 };
    }).some(({ h, m }) => isBooked(h, m) || isPast(h, m));

  const canBook = effectiveHour !== null && !hasConflict;

  const estimatedKwh = (charger.power_kw * duration).toFixed(1);
  const estimatedCost = Math.round(estimatedKwh * charger.price_per_kwh);

  function openDirections() {
    const lat = chargerLat || charger.latitude;
    const lng = chargerLng || charger.longitude;
    if (!lat || !lng) { Alert.alert('Location unavailable'); return; }
    const url = Platform.OS === 'ios'
      ? `maps:0,0?q=${lat},${lng}`
      : `geo:${lat},${lng}?q=${lat},${lng}`;
    Linking.openURL(url).catch(() =>
      Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`)
    );
  }

  async function handleBook() {
    if (!canBook) { Alert.alert('Select a time', 'Pick an available start time first.'); return; }
    setLoading(true);
    try {
      const { data: initData } = await apiInitiateBooking(charger.id, startTime.toISOString(), endTime.toISOString());
      Alert.alert(
        'Payment Required',
        `Amount: ₹${Math.round(initData.amount / 100)}\n\nIn production, Razorpay payment sheet opens here.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Simulate (Test)', onPress: () => simulatePayment(initData) },
        ],
      );
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || 'Could not initiate booking');
    } finally {
      setLoading(false);
    }
  }

  async function simulatePayment(initData) {
    setLoading(true);
    try {
      const { data } = await apiConfirmBooking({
        razorpay_order_id: initData.order_id,
        razorpay_payment_id: 'pay_test_' + Date.now(),
        razorpay_signature: 'test_signature',
        charger_id: charger.id,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
      });
      navigation.replace('BookingConfirmed', { booking: data.booking });
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || 'Booking failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

      {/* Charger info + directions */}
      <Text style={styles.name}>{charger.title}</Text>
      <View style={styles.locRow}>
        <Text style={styles.locText} numberOfLines={1}>
          📍 {charger.address || charger.city || 'Location on map'}
        </Text>
        <TouchableOpacity style={styles.dirBtn} onPress={openDirections}>
          <Text style={styles.dirBtnText}>Directions ↗</Text>
        </TouchableOpacity>
      </View>

      {/* Residential restriction notice */}
      {!isCommercial && (
        <View style={styles.noticeBox}>
          <Text style={styles.noticeText}>
            🏠 Home/Society charger · Bookings available 6AM – 10PM only
          </Text>
        </View>
      )}

      {/* Date tabs */}
      <Text style={styles.label}>Date</Text>
      <View style={styles.dateRow}>
        {dateTabs.map((d, i) => (
          <TouchableOpacity
            key={i}
            style={[styles.dateTab, dateIdx === i && styles.dateTabSel]}
            onPress={() => setDateIdx(i)}
          >
            <Text style={[styles.dateTabTop, dateIdx === i && styles.dateTabTopSel]}>{DAY_LABELS[i]}</Text>
            <Text style={[styles.dateTabBot, dateIdx === i && styles.dateTabBotSel]}>
              {d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Time slots grid */}
      <View style={styles.slotHeader}>
        <Text style={styles.label}>Start Time</Text>
        {slotsLoading && <ActivityIndicator color={colors.primary} size="small" />}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.slotsScroll}
        contentContainerStyle={styles.slotsContent}
      >
        {SLOT_HOURS.map(h => {
          const booked = isBooked(h);
          const past = isPast(h);
          const sel = !usingCustomTime && startHour === h;
          const disabled = booked || past;
          return (
            <TouchableOpacity
              key={h}
              style={[styles.slot, sel && styles.slotSel, booked && styles.slotBooked, past && styles.slotPast]}
              onPress={() => {
                if (!disabled) {
                  setStartHour(sel ? null : h);
                  setStartMinute(0);
                  setUsingCustomTime(false);
                }
              }}
              disabled={disabled}
              activeOpacity={0.75}
            >
              <Text style={[styles.slotHour, sel && styles.slotHourSel, disabled && styles.slotHourOff]}>
                {hourLabel(h)}
              </Text>
              {booked && <Text style={styles.slotTag}>busy</Text>}
              {past && !booked && <Text style={[styles.slotTag, { color: colors.textMuted }]}>past</Text>}
            </TouchableOpacity>
          );
        })}

        {/* Custom time button */}
        <TouchableOpacity
          style={[styles.slot, styles.slotCustom, usingCustomTime && styles.slotSel]}
          onPress={() => {
            const init = new Date(selDate);
            init.setHours(isCommercial ? 0 : 6, 0, 0, 0);
            setCustomTime(init);
            setShowCustomPicker(true);
          }}
        >
          <Text style={[styles.slotHour, { color: colors.blue }]}>🕐</Text>
          <Text style={[styles.slotTag, { color: usingCustomTime ? colors.primary : colors.blue }]}>
            {usingCustomTime ? formatTime(startHour, startMinute) : 'custom'}
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Native time picker — iOS inline, Android dialog */}
      {showCustomPicker && (
        Platform.OS === 'ios' ? (
          <Modal transparent animationType="slide">
            <View style={styles.pickerOverlay}>
              <View style={styles.pickerCard}>
                <Text style={styles.pickerTitle}>Select Time</Text>
                <DateTimePicker
                  value={customTime}
                  mode="time"
                  display="spinner"
                  minuteInterval={15}
                  textColor={colors.textPrimary}
                  onChange={onCustomTimeChange}
                  style={{ backgroundColor: colors.card }}
                />
                <TouchableOpacity style={styles.pickerDone} onPress={() => setShowCustomPicker(false)}>
                  <Text style={styles.pickerDoneText}>Done</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>
        ) : (
          <DateTimePicker
            value={customTime}
            mode="time"
            display="clock"
            minuteInterval={15}
            onChange={onCustomTimeChange}
          />
        )
      )}

      {/* Legend */}
      <View style={styles.legend}>
        <Dot color={colors.primary} label="Free" />
        <Dot color={colors.danger} label="Booked" />
        <Dot color={colors.textMuted} label="Past" />
        <Dot color={colors.blue} label="Custom" />
      </View>

      {/* Duration */}
      <Text style={styles.label}>Duration</Text>
      <View style={styles.durRow}>
        {DURATIONS.map(h => (
          <TouchableOpacity
            key={h}
            style={[styles.durChip, duration === h && styles.durChipSel]}
            onPress={() => setDuration(h)}
          >
            <Text style={[styles.durText, duration === h && styles.durTextSel]}>{h}h</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Selected slot summary */}
      {effectiveHour !== null && (
        <View style={styles.summaryCard}>
          <SumRow label="Start" value={startTime?.toLocaleString('en-IN', {
            weekday: 'short', day: 'numeric', month: 'short',
            hour: '2-digit', minute: '2-digit',
          })} />
          <View style={styles.hdivider} />
          <SumRow label="End" value={endTime?.toLocaleString('en-IN', {
            weekday: 'short', day: 'numeric', month: 'short',
            hour: '2-digit', minute: '2-digit',
          })} />
          {hasConflict && (
            <Text style={styles.conflict}>
              ⚠ This time overlaps a booked/past slot. Try a different time or shorter duration.
            </Text>
          )}
        </View>
      )}

      {/* Cost estimate */}
      <View style={styles.estimateCard}>
        <EstRow label="Charger Power" value={`${charger.power_kw} kW`} />
        <EstRow label="Est. Energy" value={`${estimatedKwh} kWh`} />
        <EstRow label="Rate" value={`₹${charger.price_per_kwh}/kWh`} />
        <View style={styles.hdivider} />
        <EstRow label="Est. Total" value={`₹${estimatedCost}`} highlight />
      </View>

      <Text style={styles.note}>
        Final amount based on actual kWh delivered. Any excess is refunded instantly.
      </Text>

      <TouchableOpacity
        style={[styles.btn, !canBook && styles.btnOff]}
        onPress={handleBook}
        disabled={loading || !canBook}
      >
        {loading
          ? <ActivityIndicator color="#000" />
          : <Text style={styles.btnText}>
              {effectiveHour === null
                ? 'Select a time slot above'
                : `Proceed to Pay  ₹${estimatedCost}`}
            </Text>}
      </TouchableOpacity>
    </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Dot({ color, label }) {
  const colors = useColors();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
      <Text style={{ color: colors.textMuted, fontSize: 11 }}>{label}</Text>
    </View>
  );
}
function SumRow({ label, value }) {
  const colors = useColors();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 9 }}>
      <Text style={{ color: colors.textSecondary, fontSize: 14 }}>{label}</Text>
      <Text style={{ color: colors.textPrimary, fontWeight: '600', fontSize: 14 }}>{value}</Text>
    </View>
  );
}
function EstRow({ label, value, highlight }) {
  const colors = useColors();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}>
      <Text style={{ color: colors.textSecondary, fontSize: 14 }}>{label}</Text>
      <Text style={{
        color: highlight ? colors.primary : colors.textPrimary,
        fontWeight: highlight ? '700' : '500', fontSize: 14,
      }}>{value}</Text>
    </View>
  );
}

function makeStyles(c) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg },
  content: { padding: 20, paddingBottom: 50 },

  name: { fontSize: 20, fontWeight: '800', color: c.textPrimary, marginBottom: 6 },
  locRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  locText: { fontSize: 13, color: c.textSecondary, flex: 1, marginRight: 8 },
  dirBtn: {
    backgroundColor: '#0d1f2d', borderColor: c.blue, borderWidth: 1,
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5,
  },
  dirBtnText: { color: c.blue, fontSize: 12, fontWeight: '700' },

  noticeBox: {
    backgroundColor: '#1a1a0d', borderColor: '#FFA72644', borderWidth: 1,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 16,
  },
  noticeText: { color: '#FFA726', fontSize: 12, fontWeight: '500' },

  label: { fontSize: 11, color: c.textMuted, textTransform: 'uppercase', letterSpacing: 0.9, marginBottom: 10 },

  dateRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  dateTab: {
    flex: 1, backgroundColor: c.card, borderColor: c.cardBorder,
    borderWidth: 1, borderRadius: 12, paddingVertical: 10, alignItems: 'center',
  },
  dateTabSel: { backgroundColor: c.primaryDim, borderColor: c.primary },
  dateTabTop: { fontSize: 13, fontWeight: '700', color: c.textSecondary, marginBottom: 2 },
  dateTabTopSel: { color: c.primary },
  dateTabBot: { fontSize: 12, color: c.textMuted },
  dateTabBotSel: { color: c.primary + '99' },

  slotHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  slotsScroll: { marginHorizontal: -20, marginBottom: 12 },
  slotsContent: { paddingHorizontal: 20, gap: 8, paddingBottom: 4 },
  slot: {
    backgroundColor: c.card, borderColor: c.primary, borderWidth: 1.5,
    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8,
    alignItems: 'center', minWidth: 64,
  },
  slotSel: { backgroundColor: c.primaryDim },
  slotBooked: { backgroundColor: '#1a0d0d', borderColor: c.danger },
  slotPast: { backgroundColor: c.card, borderColor: c.cardBorder, opacity: 0.4 },
  slotCustom: { borderColor: c.blue, borderStyle: 'dashed', minWidth: 72 },
  slotHour: { color: c.primary, fontSize: 13, fontWeight: '700' },
  slotHourSel: { color: c.primary },
  slotHourOff: { color: c.textMuted },
  slotTag: { fontSize: 9, color: c.danger, marginTop: 2, fontWeight: '600' },

  legend: { flexDirection: 'row', gap: 14, marginBottom: 22 },

  durRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  durChip: {
    backgroundColor: c.card, borderColor: c.cardBorder,
    borderWidth: 1, borderRadius: 12, paddingHorizontal: 18, paddingVertical: 10,
  },
  durChipSel: { backgroundColor: c.primaryDim, borderColor: c.primary },
  durText: { color: c.textSecondary, fontWeight: '600', fontSize: 15 },
  durTextSel: { color: c.primary },

  summaryCard: {
    backgroundColor: c.card, borderColor: c.cardBorder,
    borderWidth: 1, borderRadius: 14, paddingHorizontal: 16, marginBottom: 16,
  },
  hdivider: { height: 1, backgroundColor: c.cardBorder },
  conflict: { color: c.star, fontSize: 12, paddingVertical: 8, lineHeight: 18 },

  estimateCard: {
    backgroundColor: c.card, borderColor: c.cardBorder,
    borderWidth: 1, borderRadius: 14, paddingHorizontal: 16,
    paddingTop: 4, paddingBottom: 4, marginBottom: 14,
  },

  note: { fontSize: 12, color: c.textMuted, marginBottom: 24, lineHeight: 18 },
  btn: { backgroundColor: c.primary, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  btnOff: { backgroundColor: c.primaryDim, opacity: 0.6 },
  btnText: { color: '#000', fontWeight: '800', fontSize: 16 },

  // iOS time picker modal
  pickerOverlay: {
    flex: 1, backgroundColor: '#000000aa',
    justifyContent: 'flex-end',
  },
  pickerCard: {
    backgroundColor: c.card, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingBottom: 30,
  },
  pickerTitle: {
    color: c.textPrimary, fontWeight: '700', fontSize: 16,
    textAlign: 'center', paddingTop: 20, paddingBottom: 8,
  },
  pickerDone: {
    backgroundColor: c.primary, borderRadius: 12,
    marginHorizontal: 20, paddingVertical: 14, alignItems: 'center', marginTop: 8,
  },
  pickerDoneText: { color: '#000', fontWeight: '800', fontSize: 15 },
});
}
