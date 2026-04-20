import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, ActivityIndicator,
  TouchableOpacity, TextInput, Platform, Keyboard, Animated,
  Dimensions, StatusBar,
} from 'react-native';
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';
import { useChargerStore } from '../store/chargerStore';
import ChargerCard from '../components/ChargerCard';
import FilterBar from '../components/FilterBar';
import { colors } from '../constants/colors';

const { height: SCREEN_H } = Dimensions.get('window');
const SHEET_OPEN = SCREEN_H * 0.52;
const SHEET_CLOSED = 56;

function buildLeafletHTML(userLat, userLng, chargers) {
  const markersJs = chargers
    .filter(c => !isNaN(parseFloat(c.latitude)) && !isNaN(parseFloat(c.longitude)))
    .map(c => `
      L.circleMarker([${parseFloat(c.latitude)}, ${parseFloat(c.longitude)}], {
        radius: 14,
        fillColor: '${c.is_available ? '#C8FF00' : '#4DA6FF'}',
        color: '#fff',
        weight: 2.5,
        fillOpacity: 1,
      }).addTo(map).bindPopup('${(c.title || 'Charger').replace(/'/g, "\\'")}').on('click', function() {
        window.ReactNativeWebView.postMessage(JSON.stringify({ id: '${c.id}', lat: ${parseFloat(c.latitude)}, lng: ${parseFloat(c.longitude)} }));
      });
    `).join('');

  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body, #map { width: 100%; height: 100%; background: #1a1a1a; }
</style>
</head>
<body>
<div id="map"></div>
<script>
  var map = L.map('map', { zoomControl: false }).setView([${userLat}, ${userLng}], 14);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap',
    maxZoom: 19,
  }).addTo(map);

  // User location marker
  L.circleMarker([${userLat}, ${userLng}], {
    radius: 10, fillColor: '#fff', color: '#C8FF00',
    weight: 3, fillOpacity: 1,
  }).addTo(map).bindPopup('You are here');

  ${markersJs}

  map.on('click', function() {
    window.ReactNativeWebView.postMessage(JSON.stringify({ action: 'mapTap' }));
  });
</script>
</body>
</html>`;
}

export default function MapScreen({ navigation }) {
  const webRef = useRef(null);
  const [userLocation, setUserLocation] = useState(null);
  const [locating, setLocating] = useState(true);
  const [locationError, setLocationError] = useState(null);
  const [searchText, setSearchText] = useState('');
  const [searching, setSearching] = useState(false);
  const [mapReady, setMapReady] = useState(false);

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
      fetchNearby(coords.latitude, coords.longitude);
    } catch {
      setLocationError('Could not get location. Search manually.');
    } finally {
      setLocating(false);
    }
  }

  async function searchLocation() {
    if (!searchText.trim()) return;
    Keyboard.dismiss();
    setSearching(true);
    try {
      const results = await Location.geocodeAsync(searchText.trim());
      if (!results?.length) { setLocationError('Location not found.'); return; }
      const { latitude, longitude } = results[0];
      const coords = { latitude, longitude };
      setUserLocation(coords);
      fetchNearby(latitude, longitude);
      setLocationError(null);
    } catch { setLocationError('Search failed.'); }
    finally { setSearching(false); }
  }

  const loadChargers = useCallback(() => {
    if (!userLocation) return;
    fetchNearby(userLocation.latitude, userLocation.longitude);
  }, [userLocation, fetchNearby]);

  function animateSheet(open) {
    setSheetOpen(open);
    Animated.spring(sheetAnim, {
      toValue: open ? SHEET_OPEN : SHEET_CLOSED,
      useNativeDriver: false,
      tension: 65, friction: 13,
    }).start();
  }

  function onWebMessage(event) {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.action === 'mapTap') {
        animateSheet(false);
      } else if (data.id) {
        navigation.navigate('ChargerDetail', {
          chargerId: data.id,
          chargerLat: data.lat,
          chargerLng: data.lng,
        });
      }
    } catch {}
  }

  const mapHtml = userLocation
    ? buildLeafletHTML(userLocation.latitude, userLocation.longitude, chargers)
    : null;

  return (
    <View style={styles.container}>
      {/* Map */}
      {mapHtml ? (
        <WebView
          ref={webRef}
          style={StyleSheet.absoluteFill}
          source={{ html: mapHtml }}
          onMessage={onWebMessage}
          onLoad={() => setMapReady(true)}
          javaScriptEnabled
          originWhitelist={['*']}
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.mapPlaceholder]}>
          {locating
            ? <><ActivityIndicator color={colors.primary} size="large" /><Text style={styles.placeholderText}>Getting your location...</Text></>
            : <Text style={styles.placeholderText}>Search a location below</Text>
          }
        </View>
      )}

      {/* Floating buttons */}
      <View style={styles.floatRight}>
        {chargers.length > 0 && (
          <View style={styles.countPill}>
            <Text style={styles.countText}>⚡ {chargers.length}</Text>
          </View>
        )}
        <TouchableOpacity style={styles.iconBtn} onPress={detectMyLocation} disabled={locating}>
          {locating ? <ActivityIndicator color={colors.primary} size="small" /> : <Text style={styles.iconBtnText}>📍</Text>}
        </TouchableOpacity>
        {userLocation && (
          <TouchableOpacity style={styles.iconBtn} onPress={loadChargers}>
            <Text style={styles.iconBtnText}>↺</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Bottom sheet */}
      <Animated.View style={[styles.sheet, { height: sheetAnim }]}>
        <TouchableOpacity style={styles.handleWrap} onPress={() => animateSheet(!sheetOpen)} activeOpacity={0.7}>
          <View style={styles.handle} />
        </TouchableOpacity>

        {sheetOpen && (
          <>
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

            <FilterBar onFilterChange={loadChargers} />

            {loading && <ActivityIndicator color={colors.primary} style={{ marginVertical: 8 }} />}

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
  mapPlaceholder: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card },
  placeholderText: { color: colors.textSecondary, fontSize: 14, marginTop: 8 },

  floatRight: {
    position: 'absolute',
    top: (StatusBar.currentHeight || 0) + 12,
    right: 14,
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
