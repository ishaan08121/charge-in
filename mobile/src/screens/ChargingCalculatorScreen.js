import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { apiGetMe } from '../api/users';
import { colors } from '../constants/colors';

export default function ChargingCalculatorScreen({ navigation }) {
  const [evMake, setEvMake] = useState('');
  const [evModel, setEvModel] = useState('');
  const [batteryKwh, setBatteryKwh] = useState('');
  const [loadingProfile, setLoadingProfile] = useState(true);

  // Inputs
  const [currentPct, setCurrentPct] = useState('20');
  const [targetPct, setTargetPct] = useState('80');
  const [chargerKw, setChargerKw] = useState('7.2');
  const [pricePerKwh, setPricePerKwh] = useState('12');

  // Results
  const [result, setResult] = useState(null);

  // Load EV profile from server each time screen is focused
  useFocusEffect(
    useCallback(() => {
      setLoadingProfile(true);
      apiGetMe()
        .then(({ data }) => {
          const u = data.user;
          if (u.ev_make) setEvMake(u.ev_make);
          if (u.ev_model) setEvModel(u.ev_model);
          if (u.ev_battery_kwh) setBatteryKwh(String(u.ev_battery_kwh));
        })
        .catch(() => {})
        .finally(() => setLoadingProfile(false));
    }, [])
  );

  function calculate() {
    const battery = parseFloat(batteryKwh);
    const current = parseFloat(currentPct);
    const target = parseFloat(targetPct);
    const charger = parseFloat(chargerKw);
    const price = parseFloat(pricePerKwh);

    if (!battery || battery <= 0) return alert('Enter your battery capacity (kWh)');
    if (isNaN(current) || isNaN(target)) return alert('Enter current and target battery %');
    if (current >= target) return alert('Target % must be higher than current %');
    if (current < 0 || target > 100) return alert('Battery % must be between 0 and 100');
    if (!charger || charger <= 0) return alert('Enter charger power (kW)');
    if (!price || price <= 0) return alert('Enter price per unit (₹/kWh)');

    const kwhNeeded = (battery * (target - current)) / 100;

    // Charging is not 100% efficient — factor in ~10% charging loss
    const kwhFromGrid = kwhNeeded / 0.9;

    // Time in hours (real charger output is ~90% of rated due to thermal limits)
    const effectiveKw = charger * 0.9;
    const timeHours = kwhNeeded / effectiveKw;
    const timeH = Math.floor(timeHours);
    const timeM = Math.round((timeHours - timeH) * 60);

    const cost = kwhFromGrid * price;

    // EV range estimate (average Indian EV efficiency ~6 km/kWh)
    const rangeAdded = Math.round(kwhNeeded * 6);

    setResult({ kwhNeeded, kwhFromGrid, timeH, timeM, cost, rangeAdded });
  }

  const hasEVProfile = evMake && evModel && batteryKwh;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        {/* EV Profile banner */}
        {loadingProfile ? (
          <ActivityIndicator color={colors.primary} style={{ marginBottom: 16 }} />
        ) : hasEVProfile ? (
          <View style={styles.evBanner}>
            <Text style={styles.evBannerIcon}>🚗</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.evBannerName}>{evMake} {evModel}</Text>
              <Text style={styles.evBannerSub}>{batteryKwh} kWh battery · auto-filled</Text>
            </View>
            <TouchableOpacity onPress={() => navigation.navigate('EVProfile')}>
              <Text style={styles.evBannerChange}>Change</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={styles.setupEVBtn} onPress={() => navigation.navigate('EVProfile')}>
            <Text style={styles.setupEVText}>⚡ Set up your EV profile for auto-fill →</Text>
          </TouchableOpacity>
        )}

        {/* Inputs */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Battery</Text>

          <Row label="Battery capacity (kWh)">
            <TextInput
              style={styles.inputSmall}
              value={batteryKwh}
              onChangeText={setBatteryKwh}
              keyboardType="decimal-pad"
              placeholder="e.g. 40.5"
              placeholderTextColor={colors.textMuted}
            />
          </Row>

          <Row label="Current charge %">
            <TextInput
              style={styles.inputSmall}
              value={currentPct}
              onChangeText={setCurrentPct}
              keyboardType="number-pad"
              placeholder="20"
              placeholderTextColor={colors.textMuted}
            />
            <Text style={styles.unit}>%</Text>
          </Row>

          <Row label="Target charge %">
            <TextInput
              style={styles.inputSmall}
              value={targetPct}
              onChangeText={setTargetPct}
              keyboardType="number-pad"
              placeholder="80"
              placeholderTextColor={colors.textMuted}
            />
            <Text style={styles.unit}>%</Text>
          </Row>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Charger</Text>

          <Row label="Charger power (kW)">
            <TextInput
              style={styles.inputSmall}
              value={chargerKw}
              onChangeText={setChargerKw}
              keyboardType="decimal-pad"
              placeholder="7.2"
              placeholderTextColor={colors.textMuted}
            />
            <Text style={styles.unit}>kW</Text>
          </Row>

          {/* Quick charger presets */}
          <View style={styles.presetRow}>
            {[['3.3 kW\nSlow', '3.3'], ['7.2 kW\nAC', '7.2'], ['22 kW\nFast AC', '22'], ['50 kW\nDC', '50']].map(([label, val]) => (
              <TouchableOpacity
                key={val}
                style={[styles.preset, chargerKw === val && styles.presetActive]}
                onPress={() => setChargerKw(val)}
              >
                <Text style={[styles.presetText, chargerKw === val && styles.presetTextActive]}>
                  {label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Row label="Price per unit (₹/kWh)">
            <Text style={styles.rupee}>₹</Text>
            <TextInput
              style={styles.inputSmall}
              value={pricePerKwh}
              onChangeText={setPricePerKwh}
              keyboardType="decimal-pad"
              placeholder="12"
              placeholderTextColor={colors.textMuted}
            />
          </Row>
        </View>

        <TouchableOpacity style={styles.calcBtn} onPress={calculate}>
          <Text style={styles.calcBtnText}>Calculate</Text>
        </TouchableOpacity>

        {/* Results */}
        {result && (
          <View style={styles.resultCard}>
            <Text style={styles.resultTitle}>Charging Estimate</Text>

            <ResultRow
              icon="⚡"
              label="Energy needed"
              value={`${result.kwhNeeded.toFixed(1)} kWh`}
              sub={`~${result.kwhFromGrid.toFixed(1)} kWh from grid (incl. losses)`}
            />
            <ResultRow
              icon="⏱"
              label="Estimated time"
              value={result.timeH > 0 ? `${result.timeH}h ${result.timeM}m` : `${result.timeM} min`}
              highlight
            />
            <ResultRow
              icon="💰"
              label="Estimated cost"
              value={`₹${result.cost.toFixed(0)}`}
              highlight
            />
            <ResultRow
              icon="🛣"
              label="Range added"
              value={`~${result.rangeAdded} km`}
              sub="Based on avg 6 km/kWh efficiency"
            />

            <View style={styles.disclaimer}>
              <Text style={styles.disclaimerText}>
                * Estimates vary based on temperature, driving style, and charger efficiency.
              </Text>
            </View>
          </View>
        )}

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Row({ label, children }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.rowRight}>{children}</View>
    </View>
  );
}

function ResultRow({ icon, label, value, sub, highlight }) {
  return (
    <View style={styles.resultRow}>
      <Text style={styles.resultIcon}>{icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.resultLabel}>{label}</Text>
        {sub && <Text style={styles.resultSub}>{sub}</Text>}
      </View>
      <Text style={[styles.resultValue, highlight && { color: colors.primary, fontSize: 18 }]}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, paddingBottom: 50 },

  evBanner: {
    backgroundColor: colors.primaryDim, borderColor: colors.primary + '44', borderWidth: 1,
    borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'center',
    marginBottom: 16, gap: 10,
  },
  evBannerIcon: { fontSize: 24 },
  evBannerName: { color: colors.primary, fontWeight: '700', fontSize: 15 },
  evBannerSub: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  evBannerChange: { color: colors.primary, fontWeight: '600', fontSize: 13 },

  setupEVBtn: {
    backgroundColor: colors.card, borderColor: colors.cardBorder, borderWidth: 1,
    borderRadius: 12, padding: 14, marginBottom: 16,
  },
  setupEVText: { color: colors.primary, fontWeight: '600', fontSize: 14, textAlign: 'center' },

  card: {
    backgroundColor: colors.card, borderColor: colors.cardBorder,
    borderWidth: 1, borderRadius: 14, padding: 16, marginBottom: 14,
  },
  cardTitle: {
    fontSize: 11, color: colors.textMuted, textTransform: 'uppercase',
    letterSpacing: 0.8, marginBottom: 12,
  },

  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  rowLabel: { color: colors.textSecondary, fontSize: 14, flex: 1 },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },

  inputSmall: {
    backgroundColor: colors.surface, borderColor: colors.cardBorder, borderWidth: 1,
    borderRadius: 10, color: colors.textPrimary, paddingHorizontal: 12,
    paddingVertical: 8, fontSize: 16, fontWeight: '700', width: 80, textAlign: 'center',
  },
  unit: { color: colors.textMuted, fontSize: 13, marginLeft: 4 },
  rupee: { color: colors.textMuted, fontSize: 16, marginRight: 2 },

  presetRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  preset: {
    flex: 1, borderColor: colors.cardBorder, borderWidth: 1,
    borderRadius: 10, paddingVertical: 8, alignItems: 'center',
  },
  presetActive: { backgroundColor: colors.primaryDim, borderColor: colors.primary },
  presetText: { color: colors.textSecondary, fontSize: 11, textAlign: 'center', lineHeight: 16 },
  presetTextActive: { color: colors.primary, fontWeight: '700' },

  calcBtn: {
    backgroundColor: colors.primary, borderRadius: 14,
    paddingVertical: 16, alignItems: 'center', marginBottom: 20,
  },
  calcBtnText: { color: '#000', fontWeight: '800', fontSize: 16 },

  resultCard: {
    backgroundColor: colors.card, borderColor: colors.primary + '44',
    borderWidth: 1.5, borderRadius: 16, padding: 18,
  },
  resultTitle: {
    fontSize: 13, color: colors.textMuted, textTransform: 'uppercase',
    letterSpacing: 0.8, marginBottom: 16, textAlign: 'center',
  },
  resultRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: colors.cardBorder, gap: 10,
  },
  resultIcon: { fontSize: 20, width: 28, textAlign: 'center' },
  resultLabel: { color: colors.textSecondary, fontSize: 13 },
  resultSub: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  resultValue: { color: colors.textPrimary, fontWeight: '800', fontSize: 16 },

  disclaimer: { marginTop: 12 },
  disclaimerText: { color: colors.textMuted, fontSize: 11, textAlign: 'center', lineHeight: 16 },
});
