import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, ActivityIndicator,
  TouchableOpacity, TextInput, Platform, Keyboard, Animated,
  Dimensions, StatusBar, PanResponder,
} from 'react-native';
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';
import { useChargerStore } from '../store/chargerStore';
import { apiGetNearby } from '../api/chargers';
import ChargerCard from '../components/ChargerCard';
import FilterModal from '../components/FilterModal';
import { useColors } from '../constants/colors';

const { height: SCREEN_H } = Dimensions.get('window');
const SHEET_OPEN = SCREEN_H * 0.52;
const SHEET_CLOSED = 56;
const ROUTE_THRESHOLD_KM = 2.0;

// --- Geo helpers ---
function toRad(deg) { return deg * Math.PI / 180; }

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function pointToSegmentKm(pLat, pLng, aLat, aLng, bLat, bLng) {
  const dx = bLng - aLng, dy = bLat - aLat;
  if (dx === 0 && dy === 0) return haversineKm(pLat, pLng, aLat, aLng);
  const t = Math.max(0, Math.min(1, ((pLng - aLng) * dx + (pLat - aLat) * dy) / (dx * dx + dy * dy)));
  return haversineKm(pLat, pLng, aLat + t * dy, aLng + t * dx);
}

function distanceToPolylineKm(lat, lng, polyline) {
  let min = Infinity;
  for (let i = 0; i < polyline.length - 1; i++) {
    const d = pointToSegmentKm(lat, lng, polyline[i][0], polyline[i][1], polyline[i + 1][0], polyline[i + 1][1]);
    if (d < min) min = d;
  }
  return min;
}

// --- Map HTML builder ---
function buildLeafletHTML(userLat, userLng, chargers, routePolyline, routeChargerIds, destLat, destLng, originLat, originLng) {
  const markersJs = chargers
    .filter(c => !isNaN(parseFloat(c.latitude)) && !isNaN(parseFloat(c.longitude)))
    .map(c => {
      const onRoute = routeChargerIds && routeChargerIds.includes(c.id);
      const fill = onRoute ? '#C8FF00' : (c.is_available ? '#00c853' : '#ef5350');
      const border = onRoute ? '#000' : '#fff';
      const radius = onRoute ? 16 : 14;
      return `
        L.circleMarker([${parseFloat(c.latitude)}, ${parseFloat(c.longitude)}], {
          radius: ${radius}, fillColor: '${fill}', color: '${border}', weight: 2.5, fillOpacity: 1,
        }).addTo(map).bindPopup('${(c.title || 'Charger').replace(/'/g, "\\'")}').on('click', function() {
          window.ReactNativeWebView.postMessage(JSON.stringify({ id: '${c.id}', lat: ${parseFloat(c.latitude)}, lng: ${parseFloat(c.longitude)} }));
        });
      `;
    }).join('');

  const routeJs = routePolyline?.length ? `
    var rl = L.polyline(${JSON.stringify(routePolyline)}, { color: '#C8FF00', weight: 4, opacity: 0.75, dashArray: '8,4' }).addTo(map);
    map.fitBounds(rl.getBounds(), { padding: [40, 40] });
  ` : '';

  const originJs = originLat && originLng ? `
    L.circleMarker([${originLat}, ${originLng}], {
      radius: 10, fillColor: '#4FC3F7', color: '#fff', weight: 2.5, fillOpacity: 1,
    }).addTo(map).bindPopup('From');
  ` : '';

  const destJs = destLat && destLng ? `
    L.circleMarker([${destLat}, ${destLng}], {
      radius: 10, fillColor: '#FF6B35', color: '#fff', weight: 2.5, fillOpacity: 1,
    }).addTo(map).bindPopup('Destination');
  ` : '';

  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>* { margin:0; padding:0; box-sizing:border-box; } html,body,#map { width:100%; height:100%; background:#1a1a1a; }</style>
</head>
<body>
<div id="map"></div>
<script>
  var map = L.map('map', { zoomControl: false }).setView([${userLat}, ${userLng}], 14);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap', maxZoom: 19 }).addTo(map);
  L.circleMarker([${userLat}, ${userLng}], { radius: 10, fillColor: '#fff', color: '#C8FF00', weight: 3, fillOpacity: 1 }).addTo(map).bindPopup('You are here');
  ${markersJs}
  ${routeJs}
  ${originJs}
  ${destJs}
  map.on('click', function() { window.ReactNativeWebView.postMessage(JSON.stringify({ action: 'mapTap' })); });
</script>
</body>
</html>`;
}

export default function MapScreen({ navigation }) {
  const colors = useColors();
  const webRef = useRef(null);
  const [userLocation, setUserLocation] = useState(null);
  const [locating, setLocating] = useState(true);
  const [locationError, setLocationError] = useState(null);
  const [searchText, setSearchText] = useState('');
  const [searching, setSearching] = useState(false);
  const [filterVisible, setFilterVisible] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [containerH, setContainerH] = useState(SCREEN_H);

  // Route mode
  const [mode, setMode] = useState('nearby');
  const [routeFrom, setRouteFrom] = useState('');
  const [routeFromCoords, setRouteFromCoords] = useState(null); // null = use current location
  const [routeTo, setRouteTo] = useState('');
  const [routeToCoords, setRouteToCoords] = useState(null);
  const [routeSearching, setRouteSearching] = useState(false);
  const [routeChargers, setRouteChargers] = useState([]);
  const [routePolyline, setRoutePolyline] = useState(null);
  const [routeOriginCoords, setRouteOriginCoords] = useState(null);
  const [routeDestCoords, setRouteDestCoords] = useState(null);
  const [routeError, setRouteError] = useState(null);

  // Autocomplete
  const [suggestions, setSuggestions] = useState([]);
  const [activeField, setActiveField] = useState(null); // 'from' | 'to'
  const debounceRef = useRef(null);

  const sheetAnim = useRef(new Animated.Value(SHEET_OPEN)).current;
  const [sheetOpen, setSheetOpen] = useState(true);

  const { chargers, loading, fetchNearby, availableOnly, setFilter, getFiltered } = useChargerStore();
  const filteredChargers = getFiltered();

  useEffect(() => { detectMyLocation(); }, []);

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', e => setKeyboardHeight(e.endCoordinates.height));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardHeight(0));
    return () => { show.remove(); hide.remove(); };
  }, []);

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
      const query = encodeURIComponent(searchText.trim());
      const bias = userLocation
        ? `&viewbox=${userLocation.longitude - 1},${userLocation.latitude + 1},${userLocation.longitude + 1},${userLocation.latitude - 1}&bounded=0`
        : '';
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1&countrycodes=in${bias}`,
        { headers: { 'User-Agent': 'charge-in-app' } }
      );
      const data = await res.json();
      if (!data?.length) { setLocationError('Location not found.'); return; }
      const coords = { latitude: parseFloat(data[0].lat), longitude: parseFloat(data[0].lon) };
      setUserLocation(coords);
      fetchNearby(coords.latitude, coords.longitude);
      setLocationError(null);
    } catch { setLocationError('Search failed.'); }
    finally { setSearching(false); }
  }

  // Photon autocomplete — returns coords directly, no extra geocoding needed
  async function fetchSuggestions(text) {
    if (!text.trim() || text.length < 2) { setSuggestions([]); return; }
    try {
      const bias = userLocation ? `&lat=${userLocation.latitude}&lon=${userLocation.longitude}` : '';
      const res = await fetch(
        `https://photon.komoot.io/api/?q=${encodeURIComponent(text)}&limit=5&lang=en${bias}`
      );
      const data = await res.json();
      const results = (data.features || []).map(f => ({
        label: [f.properties.name, f.properties.city, f.properties.state]
          .filter(Boolean).join(', '),
        lat: f.geometry.coordinates[1],
        lng: f.geometry.coordinates[0],
      })).filter(r => r.label);
      setSuggestions(results);
    } catch { setSuggestions([]); }
  }

  function onFromChange(text) {
    setRouteFrom(text);
    setRouteFromCoords(null);
    setActiveField('from');
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(text), 300);
  }

  function onToChange(text) {
    setRouteTo(text);
    setRouteToCoords(null);
    setActiveField('to');
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(text), 300);
  }

  function selectSuggestion(s) {
    if (activeField === 'from') {
      setRouteFrom(s.label);
      setRouteFromCoords({ latitude: s.lat, longitude: s.lng });
    } else {
      setRouteTo(s.label);
      setRouteToCoords({ latitude: s.lat, longitude: s.lng });
    }
    setSuggestions([]);
    setActiveField(null);
    Keyboard.dismiss();
  }

  function resetFromToCurrentLocation() {
    setRouteFrom('');
    setRouteFromCoords(null);
    setSuggestions([]);
    setActiveField(null);
  }

  async function resolveCoords(text, biasCoords) {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(text.trim())}&format=json&limit=1&countrycodes=in`,
      { headers: { 'User-Agent': 'charge-in-app' } }
    );
    const data = await res.json();
    if (!data?.length) return null;
    return { latitude: parseFloat(data[0].lat), longitude: parseFloat(data[0].lon) };
  }

  async function searchAlongRoute() {
    if (!routeTo.trim()) { setRouteError('Enter a destination'); return; }
    Keyboard.dismiss();
    setSuggestions([]);
    setRouteSearching(true);
    setRouteError(null);
    setRouteChargers([]);
    setRoutePolyline(null);
    setRouteDestCoords(null);
    setRouteOriginCoords(null);

    try {
      // Resolve origin
      let origin = routeFromCoords;
      if (!origin && routeFrom.trim()) {
        origin = await resolveCoords(routeFrom);
        if (!origin) { setRouteError('Could not find starting location'); return; }
      }
      if (!origin) {
        if (!userLocation) { setRouteError('Enable location or enter a starting point'); return; }
        origin = userLocation;
      }
      setRouteOriginCoords(origin);

      // Resolve destination
      let dest = routeToCoords;
      if (!dest) {
        dest = await resolveCoords(routeTo);
        if (!dest) { setRouteError('Destination not found'); return; }
        setRouteToCoords(dest);
      }
      setRouteDestCoords(dest);

      // Get driving route from OSRM
      const osrmRes = await fetch(
        `https://router.project-osrm.org/route/v1/driving/${origin.longitude},${origin.latitude};${dest.longitude},${dest.latitude}?overview=full&geometries=geojson`
      );
      const osrmData = await osrmRes.json();
      if (osrmData.code !== 'Ok' || !osrmData.routes?.length) {
        setRouteError('Could not find a route between these locations');
        return;
      }

      // OSRM returns [lng, lat] — convert to [lat, lng] for Leaflet
      const polyline = osrmData.routes[0].geometry.coordinates.map(([lng, lat]) => [lat, lng]);
      setRoutePolyline(polyline);

      // Sample route every ~5km and fetch chargers
      const routeLengthKm = osrmData.routes[0].distance / 1000;
      const step = Math.max(1, Math.floor(polyline.length / Math.ceil(routeLengthKm / 5)));
      const samplePoints = [];
      for (let i = 0; i < polyline.length; i += step) samplePoints.push(polyline[i]);
      samplePoints.push(polyline[polyline.length - 1]);

      const allChargers = new Map();
      await Promise.all(
        samplePoints.map(async ([lat, lng]) => {
          try {
            const { data } = await apiGetNearby(lat, lng, 5, null);
            (data.chargers || []).forEach(c => allChargers.set(c.id, c));
          } catch {}
        })
      );

      // Filter by proximity to route and sort
      const matched = [...allChargers.values()]
        .map(c => ({
          ...c,
          offRouteKm: distanceToPolylineKm(parseFloat(c.latitude), parseFloat(c.longitude), polyline),
        }))
        .filter(c => c.offRouteKm <= ROUTE_THRESHOLD_KM)
        .sort((a, b) => a.offRouteKm - b.offRouteKm);

      setRouteChargers(matched);
      if (!matched.length) setRouteError('No chargers found along this route');
    } catch {
      setRouteError('Route search failed. Check your connection and try again.');
    } finally {
      setRouteSearching(false);
    }
  }

  function clearRoute() {
    setRouteFrom('');
    setRouteFromCoords(null);
    setRouteTo('');
    setRouteToCoords(null);
    setRouteChargers([]);
    setRoutePolyline(null);
    setRouteDestCoords(null);
    setRouteOriginCoords(null);
    setRouteError(null);
    setSuggestions([]);
    setActiveField(null);
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

  const sheetOpenRef = useRef(sheetOpen);
  sheetOpenRef.current = sheetOpen;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dy) > 5,
      onPanResponderRelease: (_, gs) => {
        if (gs.dy < -20) animateSheet(true);
        else if (gs.dy > 20) animateSheet(false);
        else animateSheet(!sheetOpenRef.current);
      },
    })
  ).current;

  function onWebMessage(event) {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.action === 'mapTap') {
        setSuggestions([]);
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

  const routeChargerIds = routeChargers.map(c => c.id);
  const mapChargers = mode === 'route' && routePolyline
    ? [...new Map([...chargers, ...routeChargers].map(c => [c.id, c])).values()]
    : chargers;
  const mapHtml = userLocation
    ? buildLeafletHTML(
        userLocation.latitude, userLocation.longitude,
        mapChargers,
        mode === 'route' ? routePolyline : null,
        mode === 'route' ? routeChargerIds : null,
        routeDestCoords?.latitude, routeDestCoords?.longitude,
        routeOriginCoords?.latitude !== userLocation?.latitude ? routeOriginCoords?.latitude : null,
        routeOriginCoords?.longitude !== userLocation?.longitude ? routeOriginCoords?.longitude : null,
      )
    : null;

  const displayChargers = mode === 'route' ? routeChargers : filteredChargers;
  const showSuggestions = suggestions.length > 0 && activeField !== null;
  const s = makeStyles(colors);

  // gap = space below MapScreen container (tab bar height)
  const gap = SCREEN_H - containerH;
  const kbBottom = keyboardHeight > 0 ? Math.max(0, keyboardHeight - gap) : 0;

  return (
    <View style={s.container} onLayout={e => setContainerH(e.nativeEvent.layout.height)}>
      {mapHtml ? (
        <WebView
          ref={webRef}
          style={StyleSheet.absoluteFill}
          source={{ html: mapHtml }}
          onMessage={onWebMessage}
          onLoad={() => {}}
          javaScriptEnabled
          originWhitelist={['*']}
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, s.mapPlaceholder]}>
          {locating
            ? <><ActivityIndicator color={colors.primary} size="large" /><Text style={s.placeholderText}>Getting your location...</Text></>
            : <Text style={s.placeholderText}>Search a location below</Text>
          }
        </View>
      )}

      <View style={s.floatRight}>
        {(mode === 'nearby' ? chargers : routeChargers).length > 0 && (
          <View style={s.countPill}>
            <Text style={s.countText}>⚡ {(mode === 'nearby' ? chargers : routeChargers).length}</Text>
          </View>
        )}
        <TouchableOpacity style={s.iconBtn} onPress={detectMyLocation} disabled={locating}>
          {locating ? <ActivityIndicator color={colors.primary} size="small" /> : <Text style={s.iconBtnText}>📍</Text>}
        </TouchableOpacity>
        {userLocation && mode === 'nearby' && (
          <TouchableOpacity style={s.iconBtn} onPress={loadChargers}>
            <Text style={s.iconBtnText}>↺</Text>
          </TouchableOpacity>
        )}
      </View>

      <Animated.View style={[
        s.sheet,
        mode === 'route' && kbBottom > 0
          ? { height: containerH - kbBottom, bottom: kbBottom }
          : { height: sheetAnim, bottom: 0 },
      ]}>
        <View style={s.handleWrap} {...panResponder.panHandlers}>
          <View style={s.handle} />
        </View>

        {sheetOpen && (
          <>
            {/* Mode toggle */}
            <View style={s.modeRow}>
              <TouchableOpacity
                style={[s.modeBtn, mode === 'nearby' && s.modeBtnActive]}
                onPress={() => { setMode('nearby'); setSuggestions([]); }}
                activeOpacity={0.75}
              >
                <Text style={[s.modeBtnText, mode === 'nearby' && s.modeBtnTextActive]}>📍 Nearby</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.modeBtn, mode === 'route' && s.modeBtnActive]}
                onPress={() => setMode('route')}
                activeOpacity={0.75}
              >
                <Text style={[s.modeBtnText, mode === 'route' && s.modeBtnTextActive]}>🗺 Along Route</Text>
              </TouchableOpacity>
            </View>

            {/* Nearby mode */}
            {mode === 'nearby' && (
              <>
                <View style={s.searchRow}>
                  <View style={s.searchBox}>
                    <TextInput
                      style={s.searchInput}
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
                {locationError && <Text style={s.errorText}>{locationError}</Text>}
                <View style={s.filterRow}>
                  <TouchableOpacity
                    style={[s.availChip, availableOnly && s.availChipActive]}
                    onPress={() => setFilter('availableOnly', !availableOnly)}
                    activeOpacity={0.75}
                  >
                    <View style={[s.availDot, { backgroundColor: availableOnly ? '#00c853' : colors.textMuted }]} />
                    <Text style={[s.availChipText, availableOnly && s.availChipTextActive]}>Available now</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.filterBtn} onPress={() => setFilterVisible(true)} activeOpacity={0.75}>
                    <Text style={s.filterBtnText}>⚙ Filters</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            {/* Route mode */}
            {mode === 'route' && (
              <>
                <View style={s.routeInputs}>
                  {/* From field */}
                  <View style={[s.routeFieldRow, activeField === 'from' && s.routeFieldRowActive]}>
                    <Text style={s.routeFieldIcon}>🔵</Text>
                    {routeFrom === '' && activeField !== 'from' ? (
                      <TouchableOpacity
                        style={s.myLocationPill}
                        onPress={() => setActiveField('from')}
                        activeOpacity={0.75}
                      >
                        <Text style={s.myLocationText}>📍 My current location</Text>
                      </TouchableOpacity>
                    ) : (
                      <TextInput
                        style={s.routeInput}
                        placeholder="Starting point..."
                        placeholderTextColor={colors.textMuted}
                        value={routeFrom}
                        onChangeText={onFromChange}
                        onFocus={() => setActiveField('from')}
                        returnKeyType="next"
                        autoFocus={activeField === 'from' && routeFrom === ''}
                      />
                    )}
                    {routeFrom !== '' && (
                      <TouchableOpacity onPress={resetFromToCurrentLocation} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Text style={s.clearFieldText}>✕</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  <View style={s.routeDivider} />

                  {/* To field */}
                  <View style={[s.routeFieldRow, activeField === 'to' && s.routeFieldRowActive]}>
                    <Text style={s.routeFieldIcon}>🔴</Text>
                    <TextInput
                      style={s.routeInput}
                      placeholder="Where are you going?"
                      placeholderTextColor={colors.textMuted}
                      value={routeTo}
                      onChangeText={onToChange}
                      onFocus={() => { setActiveField('to'); if (suggestions.length === 0 && routeTo.length >= 2) fetchSuggestions(routeTo); }}
                      onSubmitEditing={searchAlongRoute}
                      returnKeyType="search"
                    />
                    {routeSearching
                      ? <ActivityIndicator color={colors.primary} size="small" />
                      : <TouchableOpacity onPress={searchAlongRoute} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                          <Text style={{ fontSize: 15 }}>🔍</Text>
                        </TouchableOpacity>
                    }
                  </View>
                </View>

                {/* Autocomplete suggestions */}
                {showSuggestions && (
                  <View style={s.suggestionsBox}>
                    {suggestions.map((s2, i) => (
                      <TouchableOpacity
                        key={i}
                        style={[s.suggestionRow, i < suggestions.length - 1 && s.suggestionRowBorder]}
                        onPress={() => selectSuggestion(s2)}
                        activeOpacity={0.7}
                      >
                        <Text style={s.suggestionIcon}>📌</Text>
                        <Text style={s.suggestionText} numberOfLines={1}>{s2.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                {routePolyline && !showSuggestions && (
                  <View style={s.routeInfoRow}>
                    <Text style={s.routeInfoText}>
                      ⚡ {routeChargers.length} charger{routeChargers.length !== 1 ? 's' : ''} along route
                    </Text>
                    <TouchableOpacity onPress={clearRoute}>
                      <Text style={s.clearRouteText}>✕ Clear</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {routeError && <Text style={s.errorText}>{routeError}</Text>}
              </>
            )}

            {loading && mode === 'nearby' && <ActivityIndicator color={colors.primary} style={{ marginVertical: 8 }} />}

            {!showSuggestions && (
              <FlatList
                data={displayChargers}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <ChargerCard
                    charger={item}
                    onPress={() => navigation.navigate('ChargerDetail', {
                      chargerId: item.id,
                      chargerLat: parseFloat(item.latitude),
                      chargerLng: parseFloat(item.longitude),
                    })}
                    offRouteKm={mode === 'route' ? item.offRouteKm : undefined}
                  />
                )}
                ListEmptyComponent={
                  !loading && !routeSearching && (
                    <View style={s.emptyBox}>
                      <Text style={s.emptyIcon}>{mode === 'route' ? '🗺' : '🔌'}</Text>
                      <Text style={s.emptyText}>
                        {mode === 'route' ? 'Enter a destination above' : 'No chargers found nearby'}
                      </Text>
                      <Text style={s.emptySub}>
                        {mode === 'route' ? "We'll find chargers along your route" : 'Try a larger radius or different area'}
                      </Text>
                    </View>
                  )
                }
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 16 }}
                keyboardShouldPersistTaps="handled"
              />
            )}
          </>
        )}
      </Animated.View>

      <FilterModal
        visible={filterVisible}
        onClose={() => setFilterVisible(false)}
        onApply={loadChargers}
      />
    </View>
  );
}

function makeStyles(c) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    mapPlaceholder: { alignItems: 'center', justifyContent: 'center', backgroundColor: c.card },
    placeholderText: { color: c.textSecondary, fontSize: 14, marginTop: 8 },

    floatRight: {
      position: 'absolute',
      top: (StatusBar.currentHeight || 0) + 12,
      right: 14,
      alignItems: 'center', gap: 8,
    },
    countPill: {
      backgroundColor: c.card + 'ee', borderColor: c.primary,
      borderWidth: 1.5, borderRadius: 20,
      paddingHorizontal: 12, paddingVertical: 6,
    },
    countText: { color: c.primary, fontSize: 13, fontWeight: '700' },
    iconBtn: {
      backgroundColor: c.card + 'ee', borderColor: c.cardBorder,
      borderWidth: 1, borderRadius: 12,
      width: 44, height: 44, alignItems: 'center', justifyContent: 'center',
    },
    iconBtnText: { fontSize: 20, color: c.textPrimary },

    sheet: {
      position: 'absolute', bottom: 0, left: 0, right: 0,
      backgroundColor: c.bg,
      borderTopLeftRadius: 22, borderTopRightRadius: 22,
      borderTopWidth: 1, borderColor: c.cardBorder,
      shadowColor: '#000', shadowOffset: { width: 0, height: -6 },
      shadowOpacity: 0.35, shadowRadius: 12, elevation: 24,
    },
    handleWrap: { alignItems: 'center', paddingTop: 10, paddingBottom: 6 },
    handle: { width: 44, height: 4, backgroundColor: c.cardBorder, borderRadius: 2 },

    modeRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 14, marginBottom: 10 },
    modeBtn: {
      flex: 1, paddingVertical: 9, borderRadius: 10,
      borderWidth: 1.5, borderColor: c.cardBorder,
      backgroundColor: c.filterBg, alignItems: 'center',
    },
    modeBtnActive: { borderColor: c.primary, backgroundColor: c.primaryDim },
    modeBtnText: { color: c.textSecondary, fontSize: 13, fontWeight: '600' },
    modeBtnTextActive: { color: c.primary },

    searchRow: { paddingHorizontal: 14, marginBottom: 6 },
    searchBox: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      backgroundColor: c.card, borderColor: c.cardBorder, borderWidth: 1,
      borderRadius: 12, paddingHorizontal: 14,
      paddingVertical: Platform.OS === 'ios' ? 11 : 8,
    },
    searchInput: { flex: 1, color: c.textPrimary, fontSize: 14 },

    filterRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 14, marginBottom: 8 },
    availChip: {
      flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      gap: 6, paddingVertical: 9, borderRadius: 10,
      borderWidth: 1.5, borderColor: c.cardBorder, backgroundColor: c.filterBg,
    },
    availChipActive: { borderColor: '#00c853', backgroundColor: '#00c85322' },
    availDot: { width: 8, height: 8, borderRadius: 4 },
    availChipText: { color: c.textSecondary, fontSize: 13, fontWeight: '600' },
    availChipTextActive: { color: '#00c853' },
    filterBtn: {
      paddingHorizontal: 16, paddingVertical: 9,
      borderRadius: 10, borderWidth: 1, borderColor: c.cardBorder,
      backgroundColor: c.filterBg, alignItems: 'center', justifyContent: 'center',
    },
    filterBtnText: { color: c.textSecondary, fontSize: 13, fontWeight: '600' },

    // Route inputs
    routeInputs: {
      marginHorizontal: 14, marginBottom: 8,
      backgroundColor: c.card, borderColor: c.cardBorder,
      borderWidth: 1, borderRadius: 14, overflow: 'hidden',
    },
    routeFieldRow: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      paddingHorizontal: 14, paddingVertical: Platform.OS === 'ios' ? 12 : 9,
    },
    routeFieldRowActive: { backgroundColor: c.surface },
    routeFieldIcon: { fontSize: 12 },
    routeInput: { flex: 1, color: c.textPrimary, fontSize: 14 },
    myLocationPill: { flex: 1 },
    myLocationText: { color: c.textMuted, fontSize: 14 },
    clearFieldText: { color: c.textMuted, fontSize: 16, paddingLeft: 4 },
    routeDivider: { height: 1, backgroundColor: c.cardBorder, marginLeft: 38 },

    // Suggestions
    suggestionsBox: {
      marginHorizontal: 14, marginBottom: 8,
      backgroundColor: c.card, borderColor: c.cardBorder,
      borderWidth: 1, borderRadius: 14, overflow: 'hidden',
    },
    suggestionRow: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      paddingHorizontal: 14, paddingVertical: 12,
    },
    suggestionRowBorder: { borderBottomWidth: 1, borderBottomColor: c.cardBorder },
    suggestionIcon: { fontSize: 14 },
    suggestionText: { flex: 1, color: c.textPrimary, fontSize: 14 },

    routeInfoRow: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      paddingHorizontal: 14, marginBottom: 8,
    },
    routeInfoText: { color: c.primary, fontSize: 13, fontWeight: '700' },
    clearRouteText: { color: c.textMuted, fontSize: 13, fontWeight: '600' },

    emptyBox: { alignItems: 'center', paddingTop: 24, paddingBottom: 16 },
    emptyIcon: { fontSize: 36, marginBottom: 8 },
    emptyText: { color: c.textSecondary, fontSize: 15, fontWeight: '600', marginBottom: 4 },
    emptySub: { color: c.textMuted, fontSize: 13, textAlign: 'center', paddingHorizontal: 20 },
    errorText: { color: c.danger, fontSize: 13, paddingHorizontal: 16, marginBottom: 6 },
  });
}
