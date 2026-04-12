import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, Image, KeyboardAvoidingView, Platform,
} from 'react-native';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import MapView, { Marker } from 'react-native-maps';
import client from '../../api/client';
import { colors } from '../../constants/colors';

const CHARGER_TYPES = [
  { label: 'AC 3.3kW (Home charger)', power: 3.3, type: 'AC' },
  { label: 'AC 7.2kW (Fast home)', power: 7.2, type: 'AC' },
  { label: 'AC 11kW', power: 11, type: 'AC' },
  { label: 'DC 15kW', power: 15, type: 'DC' },
  { label: 'DC 25kW', power: 25, type: 'DC' },
  { label: 'DC 50kW (CCS2)', power: 50, type: 'DC' },
];

const CONNECTOR_TYPES = ['Type 2', 'CCS2', 'CHAdeMO', 'GB/T', 'Type 1'];
const MIN_PHOTOS = 5;

export default function ListChargerScreen({ navigation }) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Step 1
  const [selectedChargerType, setSelectedChargerType] = useState(CHARGER_TYPES[0]);
  const [selectedConnector, setSelectedConnector] = useState(CONNECTOR_TYPES[0]);
  const [locationType, setLocationType] = useState('home');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [photos, setPhotos] = useState([]); // { uri, base64 }[]

  // Step 2
  const [location, setLocation] = useState(null);
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [locating, setLocating] = useState(false);

  // Step 3
  const [pricePerKwh, setPricePerKwh] = useState('');

  async function pickPhoto() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      // Try camera permission too
      const camStatus = await ImagePicker.requestCameraPermissionsAsync();
      if (camStatus.status !== 'granted') {
        Alert.alert('Permission needed', 'Allow photo access to upload charger photos');
        return;
      }
    }

    Alert.alert('Add Photo', 'Choose source', [
      {
        text: 'Camera', onPress: async () => {
          const result = await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.7,
            base64: true,
            allowsEditing: true,
            aspect: [4, 3],
          });
          if (!result.canceled && result.assets?.[0]) {
            setPhotos((p) => [...p, { uri: result.assets[0].uri, base64: result.assets[0].base64, mime: result.assets[0].mimeType || 'image/jpeg' }]);
          }
        },
      },
      {
        text: 'Photo Library', onPress: async () => {
          const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.7,
            base64: true,
            allowsEditing: true,
            aspect: [4, 3],
          });
          if (!result.canceled && result.assets?.[0]) {
            setPhotos((p) => [...p, { uri: result.assets[0].uri, base64: result.assets[0].base64, mime: result.assets[0].mimeType || 'image/jpeg' }]);
          }
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  function removePhoto(index) {
    setPhotos((p) => p.filter((_, i) => i !== index));
  }

  async function detectLocation() {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return Alert.alert('Permission denied');
      const loc = await Location.getCurrentPositionAsync({});
      setLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
      const [geo] = await Location.reverseGeocodeAsync(loc.coords);
      if (geo) {
        setAddress(`${geo.streetNumber || ''} ${geo.street || ''}`.trim());
        setCity(geo.city || geo.subregion || '');
      }
    } catch {
      Alert.alert('Error', 'Could not get location');
    } finally {
      setLocating(false);
    }
  }

  async function submit() {
    if (!title.trim()) return Alert.alert('Error', 'Give your charger a title');
    if (photos.length < MIN_PHOTOS) return Alert.alert('Error', `Upload at least ${MIN_PHOTOS} photos of your charger and location`);
    if (!location) return Alert.alert('Error', 'Set your charger location');
    if (!pricePerKwh || isNaN(pricePerKwh)) return Alert.alert('Error', 'Enter a valid price per kWh');

    setLoading(true);
    try {
      // 1. Create charger
      const { data: chargerData } = await client.post('/chargers', {
        title: title.trim(),
        description: description.trim() || null,
        address,
        city,
        latitude: location.latitude,
        longitude: location.longitude,
        connector_types: [selectedConnector],
        power_kw: selectedChargerType.power,
        price_per_kwh: parseFloat(pricePerKwh),
        location_type: locationType,
      });

      const chargerId = chargerData.charger.id;

      // 2. Upload each photo
      for (const photo of photos) {
        try {
          await client.post(`/chargers/${chargerId}/photos`, {
            base64: photo.base64,
            mime_type: photo.mime || 'image/jpeg',
          });
        } catch {
          // Non-fatal — charger created, some photos may fail
        }
      }

      Alert.alert('Listed! 🎉', 'Your charger is now live on Charge.in', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || 'Could not list charger');
    } finally {
      setLoading(false);
    }
  }

  function nextStep() {
    if (step === 1) {
      if (!title.trim()) return Alert.alert('Error', 'Enter a title for your charger');
      if (photos.length < MIN_PHOTOS) {
        return Alert.alert(
          `${MIN_PHOTOS} photos required`,
          `You've added ${photos.length}/${MIN_PHOTOS} photos. Add photos of the charger, socket, parking area, and access route so users know what to expect.`
        );
      }
    }
    if (step === 2 && !location) return Alert.alert('Error', 'Detect or pin your charger location');
    setStep(step + 1);
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
    <View style={styles.container}>
      {/* Step indicator */}
      <View style={styles.stepBar}>
        {[1, 2, 3].map((s) => (
          <React.Fragment key={s}>
            <View style={[styles.stepDot, s <= step && styles.stepDotActive]}>
              <Text style={[styles.stepNum, s <= step && styles.stepNumActive]}>{s}</Text>
            </View>
            {s < 3 && <View style={[styles.stepLine, s < step && styles.stepLineActive]} />}
          </React.Fragment>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* ── STEP 1: Basic details + photos ── */}
        {step === 1 && (
          <>
            <Text style={styles.stepTitle}>Step 1 of 3 · Basic details & Photos</Text>

            <Text style={styles.label}>Charger title</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Ramesh's Home Charger"
              placeholderTextColor={colors.textMuted}
              value={title}
              onChangeText={setTitle}
            />

            <Text style={styles.label}>Charger type</Text>
            {CHARGER_TYPES.map((ct) => (
              <TouchableOpacity
                key={ct.label}
                style={[styles.optionRow, selectedChargerType.label === ct.label && styles.optionRowActive]}
                onPress={() => setSelectedChargerType(ct)}
              >
                <Text style={[styles.optionText, selectedChargerType.label === ct.label && styles.optionTextActive]}>
                  {ct.label}
                </Text>
                {selectedChargerType.label === ct.label && <Text style={{ color: colors.primary }}>✓</Text>}
              </TouchableOpacity>
            ))}

            <Text style={styles.label}>Connector type</Text>
            <View style={styles.chipRow}>
              {CONNECTOR_TYPES.map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[styles.chip, selectedConnector === c && styles.chipActive]}
                  onPress={() => setSelectedConnector(c)}
                >
                  <Text style={[styles.chipText, selectedConnector === c && styles.chipTextActive]}>{c}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Charger Location Type</Text>
            <Text style={{ fontSize: 12, color: colors.textMuted, marginBottom: 10, lineHeight: 17 }}>
              This determines booking hours. Late-night bookings only allowed for commercial chargers.
            </Text>
            {[
              { value: 'home', label: '🏠 Home / Private', sub: 'Bookings: 6AM – 10PM only' },
              { value: 'society', label: '🏢 Housing Society / Apartment', sub: 'Bookings: 6AM – 10PM only' },
              { value: 'commercial', label: '⚡ Commercial / Public', sub: 'Bookings: 24 hours' },
            ].map(opt => (
              <TouchableOpacity
                key={opt.value}
                style={[styles.optionRow, locationType === opt.value && styles.optionRowActive]}
                onPress={() => setLocationType(opt.value)}
              >
                <View>
                  <Text style={[styles.optionText, locationType === opt.value && styles.optionTextActive]}>{opt.label}</Text>
                  <Text style={{ fontSize: 11, color: locationType === opt.value ? colors.primary + '99' : colors.textMuted, marginTop: 2 }}>{opt.sub}</Text>
                </View>
                {locationType === opt.value && <Text style={{ color: colors.primary }}>✓</Text>}
              </TouchableOpacity>
            ))}

            <Text style={styles.label}>Description (optional)</Text>
            <TextInput
              style={[styles.input, { height: 80 }]}
              placeholder="Parking instructions, access notes..."
              placeholderTextColor={colors.textMuted}
              value={description}
              onChangeText={setDescription}
              multiline
            />

            {/* Photos section */}
            <View style={styles.photoSectionHeader}>
              <Text style={styles.label}>Photos</Text>
              <Text style={[
                styles.photoCount,
                photos.length >= MIN_PHOTOS ? styles.photoCountOk : styles.photoCountWarn,
              ]}>
                {photos.length}/{MIN_PHOTOS} required
              </Text>
            </View>
            <Text style={styles.photoHint}>
              Include: charger unit, socket close-up, parking area, access gate, surroundings
            </Text>

            {/* Photo grid */}
            <View style={styles.photoGrid}>
              {photos.map((p, i) => (
                <View key={i} style={styles.photoThumb}>
                  <Image source={{ uri: p.uri }} style={styles.photoImg} />
                  <TouchableOpacity style={styles.photoRemove} onPress={() => removePhoto(i)}>
                    <Text style={styles.photoRemoveText}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}
              {photos.length < 10 && (
                <TouchableOpacity style={styles.photoAdd} onPress={pickPhoto}>
                  <Text style={styles.photoAddIcon}>📷</Text>
                  <Text style={styles.photoAddText}>Add photo</Text>
                </TouchableOpacity>
              )}
            </View>
          </>
        )}

        {/* ── STEP 2: Location ── */}
        {step === 2 && (
          <>
            <Text style={styles.stepTitle}>Step 2 of 3 · Set location</Text>

            <TouchableOpacity style={styles.locBtn} onPress={detectLocation} disabled={locating}>
              {locating
                ? <ActivityIndicator color={colors.primary} />
                : <Text style={styles.locBtnText}>📍 Use my current location</Text>}
            </TouchableOpacity>

            {location && (
              <MapView
                style={styles.miniMap}
                initialRegion={{ ...location, latitudeDelta: 0.005, longitudeDelta: 0.005 }}
                userInterfaceStyle="dark"
                onPress={(e) => setLocation(e.nativeEvent.coordinate)}
              >
                <Marker coordinate={location} />
              </MapView>
            )}
            <Text style={styles.hintText}>Tap map to adjust pin position</Text>

            <Text style={styles.label}>Address</Text>
            <TextInput style={styles.input} placeholder="Street address"
              placeholderTextColor={colors.textMuted} value={address} onChangeText={setAddress} />

            <Text style={styles.label}>City</Text>
            <TextInput style={styles.input} placeholder="City"
              placeholderTextColor={colors.textMuted} value={city} onChangeText={setCity} />
          </>
        )}

        {/* ── STEP 3: Pricing ── */}
        {step === 3 && (
          <>
            <Text style={styles.stepTitle}>Step 3 of 3 · Set pricing</Text>

            <View style={styles.summaryCard}>
              {photos[0] && <Image source={{ uri: photos[0].uri }} style={styles.summaryPhoto} />}
              <View style={{ padding: 14 }}>
                <Text style={styles.summaryTitle}>{title}</Text>
                <Text style={styles.summarySub}>{selectedChargerType.label} · {selectedConnector}</Text>
                <Text style={styles.summarySub}>{city || address}</Text>
                <Text style={styles.summarySub}>{photos.length} photos ✓</Text>
              </View>
            </View>

            <Text style={styles.label}>Price per kWh (₹)</Text>
            <TextInput
              style={[styles.input, styles.priceInput]}
              placeholder="e.g. 9"
              placeholderTextColor={colors.textMuted}
              keyboardType="decimal-pad"
              value={pricePerKwh}
              onChangeText={setPricePerKwh}
            />

            {pricePerKwh ? (
              <View style={styles.earningsCard}>
                <Text style={styles.earningsLabel}>Estimated earnings per 2h session</Text>
                <Text style={styles.earningsValue}>
                  ₹{(selectedChargerType.power * 2 * parseFloat(pricePerKwh || 0) * 0.9).toFixed(0)}
                  <Text style={styles.earningsSub}> after 10% platform fee</Text>
                </Text>
              </View>
            ) : null}

            <Text style={styles.pricingHint}>
              Average in India: ₹8–12/kWh. Competitive pricing gets more bookings.
            </Text>
          </>
        )}
      </ScrollView>

      {/* Footer navigation */}
      <View style={styles.footer}>
        {step > 1 && (
          <TouchableOpacity style={styles.backBtn} onPress={() => setStep(step - 1)}>
            <Text style={styles.backBtnText}>← Back</Text>
          </TouchableOpacity>
        )}
        {step < 3 ? (
          <TouchableOpacity style={[styles.nextBtn, step === 1 && { flex: 1 }]} onPress={nextStep}>
            <Text style={styles.nextBtnText}>
              {step === 1 ? 'Next: Set location →' : 'Next: Set pricing →'}
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.nextBtn} onPress={submit} disabled={loading}>
            {loading
              ? <ActivityIndicator color="#000" />
              : <Text style={styles.nextBtnText}>List my charger ✓</Text>}
          </TouchableOpacity>
        )}
      </View>
    </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  stepBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, paddingBottom: 4 },
  stepDot: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.card, borderColor: colors.cardBorder, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  stepDotActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  stepNum: { color: colors.textMuted, fontSize: 13, fontWeight: '700' },
  stepNumActive: { color: '#000' },
  stepLine: { flex: 1, height: 2, backgroundColor: colors.cardBorder, marginHorizontal: 4 },
  stepLineActive: { backgroundColor: colors.primary },
  content: { padding: 20, paddingTop: 8, paddingBottom: 40 },
  stepTitle: { fontSize: 13, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 16 },
  label: { fontSize: 13, color: colors.textSecondary, marginBottom: 8, marginTop: 14, fontWeight: '500' },
  input: {
    backgroundColor: colors.card, borderColor: colors.cardBorder, borderWidth: 1,
    borderRadius: 12, color: colors.textPrimary, paddingHorizontal: 16,
    paddingVertical: 13, fontSize: 15,
  },
  optionRow: {
    backgroundColor: colors.card, borderColor: colors.cardBorder, borderWidth: 1,
    borderRadius: 12, padding: 14, marginBottom: 8, flexDirection: 'row', justifyContent: 'space-between',
  },
  optionRowActive: { borderColor: colors.primary, backgroundColor: colors.primaryDim },
  optionText: { color: colors.textSecondary, fontSize: 14 },
  optionTextActive: { color: colors.primary, fontWeight: '600' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  chip: { backgroundColor: colors.card, borderColor: colors.cardBorder, borderWidth: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7 },
  chipActive: { backgroundColor: colors.primaryDim, borderColor: colors.primary },
  chipText: { color: colors.textSecondary, fontSize: 13 },
  chipTextActive: { color: colors.primary, fontWeight: '600' },

  // Photos
  photoSectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, marginBottom: 4 },
  photoCount: { fontSize: 13, fontWeight: '700' },
  photoCountOk: { color: colors.primary },
  photoCountWarn: { color: '#FFA726' },
  photoHint: { fontSize: 12, color: colors.textMuted, marginBottom: 12, lineHeight: 18 },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  photoThumb: { width: 100, height: 80, borderRadius: 10, overflow: 'hidden', position: 'relative' },
  photoImg: { width: '100%', height: '100%' },
  photoRemove: {
    position: 'absolute', top: 4, right: 4,
    backgroundColor: '#000000aa', borderRadius: 10,
    width: 20, height: 20, alignItems: 'center', justifyContent: 'center',
  },
  photoRemoveText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  photoAdd: {
    width: 100, height: 80, borderRadius: 10,
    backgroundColor: colors.card, borderColor: colors.cardBorder, borderWidth: 1,
    borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', gap: 4,
  },
  photoAddIcon: { fontSize: 22 },
  photoAddText: { color: colors.textMuted, fontSize: 11 },

  // Step 2
  locBtn: { backgroundColor: colors.card, borderColor: colors.primary, borderWidth: 1, borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 14 },
  locBtnText: { color: colors.primary, fontWeight: '600', fontSize: 15 },
  miniMap: { height: 180, borderRadius: 14, marginBottom: 8, overflow: 'hidden' },
  hintText: { color: colors.textMuted, fontSize: 12, textAlign: 'center', marginBottom: 16 },

  // Step 3
  summaryCard: { backgroundColor: colors.card, borderColor: colors.cardBorder, borderWidth: 1, borderRadius: 14, overflow: 'hidden', marginBottom: 20 },
  summaryPhoto: { width: '100%', height: 120 },
  summaryTitle: { fontSize: 17, fontWeight: '700', color: colors.textPrimary, marginBottom: 4 },
  summarySub: { fontSize: 13, color: colors.textSecondary, marginBottom: 2 },
  priceInput: { fontSize: 28, fontWeight: '700', color: colors.primary, textAlign: 'center', paddingVertical: 18 },
  earningsCard: { backgroundColor: colors.primaryDim, borderColor: colors.primary, borderWidth: 1, borderRadius: 12, padding: 16, marginTop: 14 },
  earningsLabel: { fontSize: 12, color: colors.primary, marginBottom: 4 },
  earningsValue: { fontSize: 22, fontWeight: '800', color: colors.primary },
  earningsSub: { fontSize: 12, fontWeight: '400', color: colors.textSecondary },
  pricingHint: { fontSize: 12, color: colors.textMuted, marginTop: 14, lineHeight: 18 },

  footer: { flexDirection: 'row', gap: 10, padding: 16, borderTopWidth: 1, borderTopColor: colors.cardBorder },
  backBtn: { backgroundColor: colors.card, borderColor: colors.cardBorder, borderWidth: 1, borderRadius: 14, paddingVertical: 15, paddingHorizontal: 18, alignItems: 'center' },
  backBtnText: { color: colors.textSecondary, fontWeight: '600', fontSize: 15 },
  nextBtn: { flex: 1, backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
  nextBtnText: { color: '#000', fontWeight: '800', fontSize: 15 },
});
