import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, Alert, ActivityIndicator, Switch,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { apiUpdateCharger } from '../../api/chargers';
import { colors } from '../../constants/colors';

const CONNECTOR_OPTIONS = ['Type 1', 'Type 2', 'CCS1', 'CCS2', 'CHAdeMO', 'GB/T'];

export default function EditChargerScreen({ route, navigation }) {
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

      <Field label="Charger Title *" value={title} onChangeText={setTitle} placeholder="e.g. Ishaan's Home Charger" />
      <Field label="Description / Access Instructions" value={description} onChangeText={setDescription} placeholder="Gate code, parking spot, etc." multiline />
      <Field label="Address" value={address} onChangeText={setAddress} placeholder="Street / building" />

      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Field label="City" value={city} onChangeText={setCity} placeholder="Dehradun" />
        </View>
        <View style={{ width: 12 }} />
        <View style={{ flex: 1 }}>
          <Field label="State" value={state} onChangeText={setState} placeholder="Uttarakhand" />
        </View>
      </View>

      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Field label="Power (kW) *" value={powerKw} onChangeText={setPowerKw} placeholder="3.3" keyboardType="decimal-pad" />
        </View>
        <View style={{ width: 12 }} />
        <View style={{ flex: 1 }}>
          <Field label="Rate (₹/kWh) *" value={pricePerKwh} onChangeText={setPricePerKwh} placeholder="10" keyboardType="decimal-pad" />
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
          style={[locTypeStyles.row, locationType === opt.value && locTypeStyles.rowSel]}
          onPress={() => setLocationType(opt.value)}
        >
          <View style={{ flex: 1 }}>
            <Text style={[locTypeStyles.label, locationType === opt.value && locTypeStyles.labelSel]}>{opt.label}</Text>
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

function Field({ label, value, onChangeText, placeholder, multiline, keyboardType }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={fieldStyles.label}>{label}</Text>
      <TextInput
        style={[fieldStyles.input, multiline && { height: 80, textAlignVertical: 'top' }]}
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

const fieldStyles = StyleSheet.create({
  label: { fontSize: 13, color: colors.textSecondary, fontWeight: '500', marginBottom: 6 },
  input: {
    backgroundColor: colors.card, borderColor: colors.cardBorder, borderWidth: 1,
    borderRadius: 12, color: colors.textPrimary, paddingHorizontal: 14,
    paddingVertical: 12, fontSize: 15,
  },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 20, paddingBottom: 50 },

  availRow: {
    backgroundColor: colors.card, borderColor: colors.cardBorder, borderWidth: 1,
    borderRadius: 14, padding: 16, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 20,
  },
  availLabel: { fontSize: 15, fontWeight: '700', color: colors.textPrimary, marginBottom: 2 },
  availSub: { fontSize: 12, color: colors.textMuted },

  row: { flexDirection: 'row' },

  earningHint: {
    backgroundColor: colors.primaryDim, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 8, marginBottom: 14,
  },
  earningHintText: { color: colors.primary, fontSize: 13, fontWeight: '600' },

  sectionLabel: {
    fontSize: 12, color: colors.textMuted, textTransform: 'uppercase',
    letterSpacing: 0.8, marginBottom: 10,
  },
  connectorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 },
  connChip: {
    backgroundColor: colors.card, borderColor: colors.cardBorder, borderWidth: 1,
    borderRadius: 10, paddingHorizontal: 16, paddingVertical: 9,
  },
  connChipActive: { backgroundColor: colors.primaryDim, borderColor: colors.primary },
  connText: { color: colors.textSecondary, fontWeight: '600', fontSize: 14 },
  connTextActive: { color: colors.primary },

  saveBtn: {
    backgroundColor: colors.primary, borderRadius: 14,
    paddingVertical: 16, alignItems: 'center',
  },
  saveBtnText: { color: '#000', fontWeight: '800', fontSize: 16 },
});

const locTypeStyles = StyleSheet.create({
  row: {
    backgroundColor: colors.card, borderColor: colors.cardBorder, borderWidth: 1,
    borderRadius: 12, padding: 14, marginBottom: 8, flexDirection: 'row',
    alignItems: 'center', gap: 8,
  },
  rowSel: { borderColor: colors.primary, backgroundColor: colors.primaryDim },
  label: { fontSize: 14, color: colors.textSecondary, fontWeight: '500' },
  labelSel: { color: colors.primary, fontWeight: '700' },
});
