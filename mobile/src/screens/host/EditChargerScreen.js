import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, Alert, ActivityIndicator, Switch,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { apiUpdateCharger } from '../../api/chargers';
import { useColors } from '../../constants/colors';

const CONNECTOR_OPTIONS = ['Type 1', 'Type 2', 'CCS1', 'CCS2', 'CHAdeMO', 'GB/T'];

export default function EditChargerScreen({ route, navigation }) {
  const colors = useColors();
  const styles = makeStyles(colors);
  const { charger } = route.params;

  const [title, setTitle] = useState(charger.title || '');
  const [description, setDescription] = useState(charger.description || '');
  const [address, setAddress] = useState(charger.address || '');
  const [city, setCity] = useState(charger.city || '');
  const [state, setState] = useState(charger.state || '');
  const [powerKw, setPowerKw] = useState(String(charger.power_kw || ''));
  const [pricePerKwh, setPricePerKwh] = useState(String(charger.price_per_kwh || ''));
  const [connectorTypes, setConnectorTypes] = useState(charger.connector_types || []);
  const [isAvailable, setIsAvailable] = useState(charger.is_available ?? true);
  const [locationType, setLocationType] = useState(charger.location_type || 'home');
  const [saving, setSaving] = useState(false);

  function toggleConnector(c) {
    setConnectorTypes(prev =>
      prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]
    );
  }

  async function handleSave() {
    if (!title.trim()) return Alert.alert('Required', 'Title is required');
    if (!powerKw || isNaN(Number(powerKw))) return Alert.alert('Required', 'Enter a valid power (kW)');
    if (!pricePerKwh || isNaN(Number(pricePerKwh))) return Alert.alert('Required', 'Enter a valid rate (₹/kWh)');

    setSaving(true);
    try {
      await apiUpdateCharger(charger.id, {
        title: title.trim(),
        description: description.trim() || null,
        address: address.trim() || null,
        city: city.trim() || null,
        state: state.trim() || null,
        power_kw: Number(powerKw),
        price_per_kwh: Number(pricePerKwh),
        connector_types: connectorTypes,
        is_available: isAvailable,
        location_type: locationType,
      });
      Alert.alert('Saved', 'Charger details updated successfully', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || 'Could not save changes');
    } finally {
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

      {/* Availability toggle */}
      <View style={styles.availRow}>
        <View>
          <Text style={styles.availLabel}>Live on Network</Text>
          <Text style={styles.availSub}>Turn off to temporarily hide from users</Text>
        </View>
        <Switch
          value={isAvailable}
          onValueChange={setIsAvailable}
          trackColor={{ false: colors.cardBorder, true: colors.primaryDim }}
          thumbColor={isAvailable ? colors.primary : colors.textMuted}
        />
      </View>

      <Field label="Charger Title *" value={title} onChangeText={setTitle} placeholder="e.g. Ishaan's Home Charger" styles={styles} colors={colors} />
      <Field label="Description / Access Instructions" value={description} onChangeText={setDescription} placeholder="Gate code, parking spot, etc." multiline styles={styles} colors={colors} />
      <Field label="Address" value={address} onChangeText={setAddress} placeholder="Street / building" styles={styles} colors={colors} />

      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Field label="City" value={city} onChangeText={setCity} placeholder="Dehradun" styles={styles} colors={colors} />
        </View>
        <View style={{ width: 12 }} />
        <View style={{ flex: 1 }}>
          <Field label="State" value={state} onChangeText={setState} placeholder="Uttarakhand" styles={styles} colors={colors} />
        </View>
      </View>

      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Field label="Power (kW) *" value={powerKw} onChangeText={setPowerKw} placeholder="3.3" keyboardType="decimal-pad" styles={styles} colors={colors} />
        </View>
        <View style={{ width: 12 }} />
        <View style={{ flex: 1 }}>
          <Field label="Rate (₹/kWh) *" value={pricePerKwh} onChangeText={setPricePerKwh} placeholder="10" keyboardType="decimal-pad" styles={styles} colors={colors} />
        </View>
      </View>

      {/* Pricing hint */}
      {pricePerKwh && !isNaN(Number(pricePerKwh)) && (
        <View style={styles.earningHint}>
          <Text style={styles.earningHintText}>
            You earn ₹{(Number(pricePerKwh) * 0.9).toFixed(1)}/kWh after 10% platform fee
          </Text>
        </View>
      )}

      {/* Location type */}
      <Text style={styles.sectionLabel}>Location Type</Text>
      {[
        { value: 'home', label: '🏠 Home / Private', sub: 'Bookings: 6AM – 10PM only' },
        { value: 'society', label: '🏢 Housing Society / Apartment', sub: 'Bookings: 6AM – 10PM only' },
        { value: 'commercial', label: '⚡ Commercial / Public', sub: 'Bookings: 24 hours' },
      ].map(opt => (
        <TouchableOpacity
          key={opt.value}
          style={[styles.locTypeRow, locationType === opt.value && styles.locTypeRowSel]}
          onPress={() => setLocationType(opt.value)}
        >
          <View style={{ flex: 1 }}>
            <Text style={[styles.locTypeLabel, locationType === opt.value && styles.locTypeLabelSel]}>{opt.label}</Text>
            <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }}>{opt.sub}</Text>
          </View>
          {locationType === opt.value && <Text style={{ color: colors.primary }}>✓</Text>}
        </TouchableOpacity>
      ))}

      {/* Connector types */}
      <Text style={styles.sectionLabel}>Connector Types *</Text>
      <View style={styles.connectorGrid}>
        {CONNECTOR_OPTIONS.map(c => (
          <TouchableOpacity
            key={c}
            style={[styles.connChip, connectorTypes.includes(c) && styles.connChipActive]}
            onPress={() => toggleConnector(c)}
          >
            <Text style={[styles.connText, connectorTypes.includes(c) && styles.connTextActive]}>{c}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
        {saving
          ? <ActivityIndicator color="#000" />
          : <Text style={styles.saveBtnText}>Save Changes</Text>}
      </TouchableOpacity>
    </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({ label, value, onChangeText, placeholder, multiline, keyboardType, styles, colors }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[styles.fieldInput, multiline && { height: 80, textAlignVertical: 'top' }]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        multiline={multiline}
        keyboardType={keyboardType || 'default'}
        autoCapitalize={keyboardType ? 'none' : 'sentences'}
      />
    </View>
  );
}

function makeStyles(c) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg },
  content: { padding: 20, paddingBottom: 50 },

  availRow: {
    backgroundColor: c.card, borderColor: c.cardBorder, borderWidth: 1,
    borderRadius: 14, padding: 16, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 20,
  },
  availLabel: { fontSize: 15, fontWeight: '700', color: c.textPrimary, marginBottom: 2 },
  availSub: { fontSize: 12, color: c.textMuted },

  row: { flexDirection: 'row' },

  fieldLabel: { fontSize: 13, color: c.textSecondary, fontWeight: '500', marginBottom: 6 },
  fieldInput: {
    backgroundColor: c.card, borderColor: c.cardBorder, borderWidth: 1,
    borderRadius: 12, color: c.textPrimary, paddingHorizontal: 14,
    paddingVertical: 12, fontSize: 15,
  },

  earningHint: {
    backgroundColor: c.primaryDim, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 8, marginBottom: 14,
  },
  earningHintText: { color: c.primary, fontSize: 13, fontWeight: '600' },

  sectionLabel: {
    fontSize: 12, color: c.textMuted, textTransform: 'uppercase',
    letterSpacing: 0.8, marginBottom: 10,
  },

  locTypeRow: {
    backgroundColor: c.card, borderColor: c.cardBorder, borderWidth: 1,
    borderRadius: 12, padding: 14, marginBottom: 8, flexDirection: 'row',
    alignItems: 'center', gap: 8,
  },
  locTypeRowSel: { borderColor: c.primary, backgroundColor: c.primaryDim },
  locTypeLabel: { fontSize: 14, color: c.textSecondary, fontWeight: '500' },
  locTypeLabelSel: { color: c.primary, fontWeight: '700' },

  connectorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 },
  connChip: {
    backgroundColor: c.card, borderColor: c.cardBorder, borderWidth: 1,
    borderRadius: 10, paddingHorizontal: 16, paddingVertical: 9,
  },
  connChipActive: { backgroundColor: c.primaryDim, borderColor: c.primary },
  connText: { color: c.textSecondary, fontWeight: '600', fontSize: 14 },
  connTextActive: { color: c.primary },

  saveBtn: {
    backgroundColor: c.primary, borderRadius: 14,
    paddingVertical: 16, alignItems: 'center',
  },
  saveBtnText: { color: '#000', fontWeight: '800', fontSize: 16 },
});
}
