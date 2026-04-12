import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { apiGetMe, apiUpdateMe } from '../api/users';
import { colors } from '../constants/colors';

const CONNECTOR_TYPES = ['CCS2', 'CHAdeMO', 'Type 2', 'GB/T', 'Type 1'];

// Popular Indian EVs with their battery capacity
const POPULAR_EVS = [
  { make: 'Tata', model: 'Nexon EV', battery_kwh: 40.5, connector: 'CCS2' },
  { make: 'Tata', model: 'Nexon EV Max', battery_kwh: 40.5, connector: 'CCS2' },
  { make: 'Tata', model: 'Punch EV', battery_kwh: 35, connector: 'CCS2' },
  { make: 'Tata', model: 'Tiago EV', battery_kwh: 24, connector: 'CCS2' },
  { make: 'Tata', model: 'Curvv EV', battery_kwh: 55, connector: 'CCS2' },
  { make: 'MG', model: 'ZS EV', battery_kwh: 50.3, connector: 'CCS2' },
  { make: 'MG', model: 'Comet EV', battery_kwh: 17.3, connector: 'CCS2' },
  { make: 'Hyundai', model: 'Creta Electric', battery_kwh: 51.4, connector: 'CCS2' },
  { make: 'Hyundai', model: 'Ioniq 5', battery_kwh: 72.6, connector: 'CCS2' },
  { make: 'Kia', model: 'EV6', battery_kwh: 77.4, connector: 'CCS2' },
  { make: 'BYD', model: 'Atto 3', battery_kwh: 60.5, connector: 'CCS2' },
  { make: 'Mahindra', model: 'XEV 9e', battery_kwh: 79, connector: 'CCS2' },
  { make: 'Mahindra', model: 'BE 6e', battery_kwh: 79, connector: 'CCS2' },
  { make: 'Ola', model: 'S1 Pro (scooter)', battery_kwh: 4, connector: 'Type 1' },
];

export default function EVProfileScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showQuickPick, setShowQuickPick] = useState(false);

  const [evMake, setEvMake] = useState('');
  const [evModel, setEvModel] = useState('');
  const [evBatteryKwh, setEvBatteryKwh] = useState('');
  const [evConnector, setEvConnector] = useState('');

  useEffect(() => {
    apiGetMe()
      .then(({ data }) => {
        const u = data.user;
        setEvMake(u.ev_make || '');
        setEvModel(u.ev_model || '');
        setEvBatteryKwh(u.ev_battery_kwh ? String(u.ev_battery_kwh) : '');
        setEvConnector(u.ev_connector_type || '');
      })
      .catch(() => Alert.alert('Error', 'Could not load profile'))
      .finally(() => setLoading(false));
  }, []);

  function pickPreset(ev) {
    setEvMake(ev.make);
    setEvModel(ev.model);
    setEvBatteryKwh(String(ev.battery_kwh));
    setEvConnector(ev.connector);
    setShowQuickPick(false);
  }

  async function save() {
    if (!evMake.trim() || !evModel.trim()) {
      return Alert.alert('Missing info', 'Please enter your car make and model');
    }
    const kwh = parseFloat(evBatteryKwh);
    if (!kwh || kwh <= 0) {
      return Alert.alert('Missing info', 'Please enter a valid battery capacity in kWh');
    }

    setSaving(true);
    try {
      await apiUpdateMe({
        ev_make: evMake.trim(),
        ev_model: evModel.trim(),
        ev_battery_kwh: kwh,
        ev_connector_type: evConnector || null,
      });
      Alert.alert('Saved!', 'Your EV profile has been updated.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || 'Could not save');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={colors.primary} size="large" /></View>;
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        <Text style={styles.subtitle}>
          Your EV info auto-fills the charging calculator so you don't have to enter it every time.
        </Text>

        {/* Quick pick */}
        <TouchableOpacity style={styles.quickPickBtn} onPress={() => setShowQuickPick(!showQuickPick)}>
          <Text style={styles.quickPickText}>
            {showQuickPick ? '▲ Hide popular EVs' : '⚡ Pick from popular Indian EVs'}
          </Text>
        </TouchableOpacity>

        {showQuickPick && (
          <View style={styles.presetList}>
            {POPULAR_EVS.map((ev, i) => (
              <TouchableOpacity key={i} style={styles.presetItem} onPress={() => pickPreset(ev)}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.presetName}>{ev.make} {ev.model}</Text>
                  <Text style={styles.presetSub}>{ev.battery_kwh} kWh · {ev.connector}</Text>
                </View>
                <Text style={styles.presetArrow}>›</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <Text style={styles.label}>Car Make (Brand)</Text>
        <TextInput
          style={styles.input}
          value={evMake}
          onChangeText={setEvMake}
          placeholder="e.g. Tata, Hyundai, MG"
          placeholderTextColor={colors.textMuted}
        />

        <Text style={styles.label}>Car Model</Text>
        <TextInput
          style={styles.input}
          value={evModel}
          onChangeText={setEvModel}
          placeholder="e.g. Nexon EV, ZS EV"
          placeholderTextColor={colors.textMuted}
        />

        <Text style={styles.label}>Battery Capacity (kWh)</Text>
        <TextInput
          style={styles.input}
          value={evBatteryKwh}
          onChangeText={setEvBatteryKwh}
          placeholder="e.g. 40.5"
          placeholderTextColor={colors.textMuted}
          keyboardType="decimal-pad"
        />

        <Text style={styles.label}>Connector Type</Text>
        <View style={styles.connectorRow}>
          {CONNECTOR_TYPES.map((c) => (
            <TouchableOpacity
              key={c}
              style={[styles.connectorChip, evConnector === c && styles.connectorChipActive]}
              onPress={() => setEvConnector(c)}
            >
              <Text style={[styles.connectorChipText, evConnector === c && styles.connectorChipTextActive]}>
                {c}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={styles.saveBtn} onPress={save} disabled={saving}>
          {saving
            ? <ActivityIndicator color="#000" />
            : <Text style={styles.saveBtnText}>Save EV Profile</Text>}
        </TouchableOpacity>

        {(evMake || evModel) && (
          <View style={styles.previewCard}>
            <Text style={styles.previewLabel}>Current EV</Text>
            <Text style={styles.previewName}>{evMake} {evModel}</Text>
            {evBatteryKwh ? <Text style={styles.previewSub}>{evBatteryKwh} kWh battery</Text> : null}
            {evConnector ? <Text style={styles.previewSub}>Connector: {evConnector}</Text> : null}
          </View>
        )}

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 20, paddingBottom: 50 },
  center: { flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' },

  subtitle: { color: colors.textSecondary, fontSize: 14, lineHeight: 20, marginBottom: 20 },

  quickPickBtn: {
    backgroundColor: colors.primaryDim, borderRadius: 12,
    paddingVertical: 12, paddingHorizontal: 16, marginBottom: 16,
  },
  quickPickText: { color: colors.primary, fontWeight: '600', fontSize: 14, textAlign: 'center' },

  presetList: {
    backgroundColor: colors.card, borderColor: colors.cardBorder,
    borderWidth: 1, borderRadius: 14, overflow: 'hidden', marginBottom: 20,
  },
  presetItem: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 13,
    borderBottomWidth: 1, borderBottomColor: colors.cardBorder,
  },
  presetName: { color: colors.textPrimary, fontWeight: '600', fontSize: 14 },
  presetSub: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  presetArrow: { color: colors.textMuted, fontSize: 20 },

  label: { color: colors.textSecondary, fontSize: 13, fontWeight: '500', marginBottom: 6, marginTop: 16 },
  input: {
    backgroundColor: colors.card, borderColor: colors.cardBorder, borderWidth: 1,
    borderRadius: 12, color: colors.textPrimary, paddingHorizontal: 16,
    paddingVertical: 13, fontSize: 15,
  },

  connectorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  connectorChip: {
    borderColor: colors.cardBorder, borderWidth: 1,
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8,
  },
  connectorChipActive: { backgroundColor: colors.primaryDim, borderColor: colors.primary },
  connectorChipText: { color: colors.textSecondary, fontSize: 13, fontWeight: '500' },
  connectorChipTextActive: { color: colors.primary, fontWeight: '700' },

  saveBtn: {
    backgroundColor: colors.primary, borderRadius: 14,
    paddingVertical: 16, alignItems: 'center', marginTop: 28,
  },
  saveBtnText: { color: '#000', fontWeight: '800', fontSize: 16 },

  previewCard: {
    backgroundColor: colors.card, borderColor: colors.cardBorder, borderWidth: 1,
    borderRadius: 14, padding: 16, marginTop: 20,
  },
  previewLabel: { fontSize: 11, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 },
  previewName: { fontSize: 18, fontWeight: '800', color: colors.textPrimary, marginBottom: 4 },
  previewSub: { fontSize: 13, color: colors.textSecondary },
});
