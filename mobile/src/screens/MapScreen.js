import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, ActivityIndicator,
  TouchableOpacity, TextInput, Platform, Keyboard, Animated,
  Dimensions,
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import { useChargerStore } from '../store/chargerStore';
import ChargerCard from '../components/ChargerCard';
import FilterBar from '../components/FilterBar';
import { colors } from '../constants/colors';

const { height: SCREEN_H } = Dimensions.get('window');
const SHEET_OPEN = SCREEN_H * 0.52;   // half screen — list fully visible
const SHEET_CLOSED = 56;              // just the handle when map is tapped

export default function MapScreen({ navigation }) {
  const mapRef = useRef(null);
  const [region, setRegion] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [locating, setLocating] = useState(true);
  const [locationError, setLocationError] = useState(null);
  const [searchText, setSearchText] = useState('');
  const [searching, setSearching] = useState(false);

  const sheetAnim = useRef(new Animated.Value(SHEET_OPEN)).current;
  const [sheetOpen, setSheetOpen] = useState(true);

  const { chargers, loading, fetchNearby } = useChargerStore();

  useEffect(() => { detectMyLocation(); }, []);

  async function detectMyLocation() {
    setLocating(true);
    setLocationError(null);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationError('Location permission denied. Search a city above.');
        setLocating(false);
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
      setUserLocation(coords);
      goToCoords(coords);
      fetchNearby(coords.latitude, coords.longitude);
    } catch {
      setLocationError('Could not get location. Search manually.');
    } finally {
      setLocating(false);
    }
  }

  function goToCoords(coords, delta = 0.04) {
    const r = { ...coords, latitudeDelta: delta, longitudeDelta: delta };
    setRegion(r);
    mapRef.current?.animateToRegion(r, 700);
  }

  async function searchLocation() {
    if (!searchText.trim()) return;
    Keyboard.dismiss();
    setSearching(true);
    try {
      const results = await Location.geocodeAsync(searchText.trim());
      if (!results?.length) { setLocationError('Location not found.'); return; }
      const { latitude, longitude } = results[0];
      goToCoords({ latitude, longitude });
      fetchNearby(latitude, longitude);
      setLocationError(null);
    } catch { setLocationError('Search failed.'); }
    finally { setSearching(false); }
  }

  const loadChargers = useCallback(() => {
    if (!region) return;
    fetchNearby(region.latitude, region.longitude);
  }, [region, fetchNearby]);

  function animateSheet(open) {
    setSheetOpen(open);
    Animated.spring(sheetAnim, {
      toValue: open ? SHEET_OPEN : SHEET_CLOSED,
      useNativeDriver: false,
      tension: 65, friction: 13,
    }).start();
  }

  return (
    <View style={styles.container}>
      {/* ── Full-screen map ── */}
      {region ? (
        <MapView
          ref={mapRef}
          style={StyleSheet.absoluteFill}
          initialRegion={region}
          onRegionChangeComplete={setRegion}
          onPress={() => animateSheet(false)}
          showsUserLocation={!!userLocation}
          showsMyLocationButton={false}
          userInterfaceStyle="dark"
        >
          {chargers
            .filter(c => !isNaN(parseFloat(c.latitude)) && !isNaN(parseFloat(c.longitude)))
            .map((c) => (
            <Marker
              key={c.id}
              coordinate={{ latitude: parseFloat(c.latitude), longitude: parseFloat(c.longitude) }}
              onPress={(e) => {
                e.stopPropagation();
                navigation.navigate('ChargerDetail', {
                  chargerId: c.id,
                  chargerLat: parseFloat(c.latitude),
                  chargerLng: parseFloat(c.longitude),
                });
              }}
            >
              <View style={[styles.pin, { backgroundColor: c.is_available ? colors.primary : colors.blue }]}>
                <Text style={styles.pinText}>⚡</Text>
              </View>
            </Marker>
          ))}
        </MapView>
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.mapPlaceholder]}>
          {locating
            ? <><ActivityIndicator color={colors.primary} size="large" /><Text style={styles.placeholderText}>Getting your location...</Text></>
            : <Text style={styles.placeholderText}>Search a location below</Text>
          }
        </View>
      )}

      {/* Floating top-right buttons */}
      <View style={styles.floatRight}>
        {chargers.length > 0 && (
          <View style={styles.countPill}>
            <Text style={styles.countText}>⚡ {chargers.length}</Text>
          </View>
        )}
        <TouchableOpacity style={styles.iconBtn} onPress={detectMyLocation} disabled={locating}>
          {locating ? <ActivityIndicator color={colors.primary} size="small" /> : <Text style={styles.iconBtnText}>📍</Text>}
        </TouchableOpacity>
        {region && (
          <TouchableOpacity style={styles.iconBtn} onPress={loadChargers}>
            <Text style={styles.iconBtnText}>↺</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ── Bottom sheet ── */}
      <Animated.View style={[styles.sheet, { height: sheetAnim }]}>
        {/* Handle */}
        <TouchableOpacity style={styles.handleWrap} onPress={() => animateSheet(!sheetOpen)} activeOpacity={0.7}>
          <View style={styles.handle} />
        </TouchableOpacity>

        {sheetOpen && (
          <>
            {/* Search row */}
            <View style={styles.searchRow}>
              <View style={styles.searchBox}>
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search city, area or locality..."
                  placeholderTextColor={colors.textMuted}
                  value={searchText}
                  onChangeText={setSearchText}
                  onSubmitEditing={searchLocation}
                  returnKeyType="search"
                />
                {searching
                  ? <ActivityIndicator color={colors.primary} size="small" />
                  : <TouchableOpacity onPress={searchLocation}><Text style={{ fontSize: 15 }}>🔍</Text></TouchableOpacity>
                }
              </View>
            </View>

            {locationError && <Text style={styles.errorText}>{locationError}</Text>}

            {/* Filter chips */}
            <FilterBar onFilterChange={loadChargers} />

            {loading && <ActivityIndicator color={colors.primary} style={{ marginVertical: 8 }} />}

            {/* Charger list */}
            <FlatList
              data={chargers}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <ChargerCard
                  charger={item}
                  onPress={() => navigation.navigate('ChargerDetail', {
                    chargerId: item.id,
                    chargerLat: parseFloat(item.latitude),
                    chargerLng: parseFloat(item.longitude),
                  })}
                />
              )}
              ListEmptyComponent={
                !loading && (
                  <View style={styles.emptyBox}>
                    <Text style={styles.emptyIcon}>🔌</Text>
                    <Text style={styles.emptyText}>No chargers found nearby</Text>
                    <Text style={styles.emptySub}>Try a larger radius or different area</Text>
                  </View>
                )
              }
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 16 }}
              keyboardShouldPersistTaps="handled"
            />
          </>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111' },

  mapPlaceholder: { alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: colors.card },
  placeholderText: { color: colors.textSecondary, fontSize: 14, marginTop: 8 },

  pin: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2.5, borderColor: '#fff',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5, shadowRadius: 4, elevation: 6,
  },
  pinText: { fontSize: 16 },

  floatRight: {
    position: 'absolute', top: 12, right: 14,
    alignItems: 'center', gap: 8,
  },
  countPill: {
    backgroundColor: colors.card + 'ee', borderColor: colors.primary,
    borderWidth: 1.5, borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  countText: { color: colors.primary, fontSize: 13, fontWeight: '700' },
  iconBtn: {
    backgroundColor: colors.card + 'ee', borderColor: colors.cardBorder,
    borderWidth: 1, borderRadius: 12,
    width: 44, height: 44, alignItems: 'center', justifyContent: 'center',
  },
  iconBtnText: { fontSize: 20 },

  // Sheet
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: colors.bg,
    borderTopLeftRadius: 22, borderTopRightRadius: 22,
    borderTopWidth: 1, borderColor: colors.cardBorder,
    shadowColor: '#000', shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.35, shadowRadius: 12, elevation: 24,
  },
  handleWrap: { alignItems: 'center', paddingTop: 10, paddingBottom: 6 },
  handle: { width: 44, height: 4, backgroundColor: colors.cardBorder, borderRadius: 2 },

  searchRow: { paddingHorizontal: 14, marginBottom: 6 },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.card, borderColor: colors.cardBorder, borderWidth: 1,
    borderRadius: 12, paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 11 : 8,
  },
  searchInput: { flex: 1, color: colors.textPrimary, fontSize: 14 },

  emptyBox: { alignItems: 'center', paddingTop: 24, paddingBottom: 16 },
  emptyIcon: { fontSize: 36, marginBottom: 8 },
  emptyText: { color: colors.textSecondary, fontSize: 15, fontWeight: '600', marginBottom: 4 },
  emptySub: { color: colors.textMuted, fontSize: 13 },
  errorText: { color: colors.danger, fontSize: 13, paddingHorizontal: 16, marginBottom: 6 },
});
