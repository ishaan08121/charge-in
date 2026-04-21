import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, Image, Dimensions, Linking,
} from 'react-native';
import { apiGetCharger, apiGetReviews } from '../api/chargers';
import { useColors } from '../constants/colors';

const { width } = Dimensions.get('window');

function Stars({ rating, size = 14, starColor }) {
  const full = Math.floor(rating);
  const half = rating % 1 >= 0.5;
  return (
    <Text style={{ color: starColor, fontSize: size }}>
      {'★'.repeat(full)}{half ? '½' : ''}{'☆'.repeat(5 - full - (half ? 1 : 0))}
    </Text>
  );
}

export default function ChargerDetailScreen({ route, navigation }) {
  const colors = useColors();
  const { chargerId, chargerLat, chargerLng } = route.params;

  function openMaps() {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${chargerLat},${chargerLng}&travelmode=driving`;
    Linking.openURL(url).catch(() => Alert.alert('Error', 'Could not open Google Maps'));
  }
  const [charger, setCharger] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [avgRating, setAvgRating] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [cRes, rRes] = await Promise.all([
          apiGetCharger(chargerId),
          apiGetReviews(chargerId),
        ]);
        setCharger(cRes.data.charger);
        setReviews(rRes.data.reviews);
        setAvgRating(rRes.data.average_rating);
      } catch {
        Alert.alert('Error', 'Could not load charger details');
        navigation.goBack();
      } finally {
        setLoading(false);
      }
    })();
  }, [chargerId]);

  const styles = makeStyles(colors);

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={colors.primary} size="large" /></View>;
  }
  if (!charger) return null;

  const photos = charger.charger_photos || [];

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingBottom: 0 }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 110 }} showsVerticalScrollIndicator={false}>

        {/* Photo gallery */}
        {photos.length > 0 ? (
          <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}>
            {photos.map((p) => (
              <Image key={p.id} source={{ uri: p.url }} style={styles.photo} />
            ))}
          </ScrollView>
        ) : (
          <View style={styles.photoPlaceholder}>
            <Text style={{ fontSize: 40 }}>🔌</Text>
            <Text style={{ color: colors.textMuted, marginTop: 8 }}>No photos yet</Text>
          </View>
        )}

        {photos.length > 1 && (
          <View style={styles.photoCount}>
            <Text style={styles.photoCountText}>📷 {photos.length} photos</Text>
          </View>
        )}

        <View style={styles.body}>
          {/* Title + price */}
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{charger.title}</Text>
              <Text style={styles.location}>
                {charger.address ? `${charger.address}, ` : ''}{charger.city || ''}
              </Text>
            </View>
            <View style={styles.priceBadge}>
              <Text style={styles.priceText}>₹{charger.price_per_kwh}/unit</Text>
            </View>
          </View>

          {/* Availability badge */}
          <View style={[styles.availBadge, { backgroundColor: charger.is_available ? colors.primaryDim : '#2a1a1a' }]}>
            <View style={[styles.availDot, { backgroundColor: charger.is_available ? colors.primary : colors.danger }]} />
            <Text style={[styles.availText, { color: charger.is_available ? colors.primary : colors.danger }]}>
              {charger.is_available ? 'Available now' : 'Currently occupied'}
            </Text>
          </View>

          {/* Info table */}
          <View style={styles.infoTable}>
            <InfoRow c={colors} label="Charger type" value={`${charger.connector_types?.join(', ') || '—'} · ${charger.power_kw} kW`} />
            <InfoRow c={colors} label="Connector" value={charger.connector_types?.join(', ') || '—'} />
            <InfoRow c={colors} label="Rate" value={`₹${charger.price_per_kwh}/kWh`} />
            {avgRating && (
              <InfoRow
                c={colors}
                label="Host rating"
                value={`${avgRating} (${reviews.length} review${reviews.length !== 1 ? 's' : ''})`}
                star
                rating={parseFloat(avgRating)}
                starColor={colors.star}
              />
            )}
            {charger.description && (
              <InfoRow c={colors} label="Access" value={charger.description} />
            )}
          </View>

          {/* Host card */}
          {charger.host && (
            <View style={styles.hostCard}>
              <View style={styles.hostAvatar}>
                <Text style={styles.hostAvatarText}>{(charger.host.full_name || 'H')[0].toUpperCase()}</Text>
              </View>
              <View>
                <Text style={styles.hostLabel}>Hosted by</Text>
                <Text style={styles.hostName}>{charger.host.full_name}</Text>
              </View>
            </View>
          )}

          {/* Reviews */}
          {reviews.length > 0 && (
            <>
              <Text style={styles.sectionLabel}>Reviews</Text>
              {reviews.slice(0, 3).map((r) => (
                <View key={r.id} style={styles.reviewCard}>
                  <View style={styles.reviewHeader}>
                    <Text style={styles.reviewerName}>{r.reviewer?.full_name || 'User'}</Text>
                    <Stars rating={r.rating} starColor={colors.star} />
                  </View>
                  {r.comment && <Text style={styles.reviewComment}>{r.comment}</Text>}
                </View>
              ))}
            </>
          )}
        </View>
      </ScrollView>

      {/* Bottom CTA bar — always show Navigate, show Book only if available */}
      <View style={styles.ctaBar}>
        <TouchableOpacity style={styles.navigateBtn} onPress={openMaps} activeOpacity={0.85}>
          <Text style={styles.navigateIcon}>🧭</Text>
          <Text style={styles.navigateText}>Navigate</Text>
        </TouchableOpacity>
        {charger.is_available ? (
          <TouchableOpacity
            style={styles.cta}
            onPress={() => navigation.navigate('BookSlot', { charger, chargerLat, chargerLng })}
            activeOpacity={0.85}
          >
            <Text style={styles.ctaText}>Book a Slot</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.ctaUnavailable}>
            <Text style={styles.ctaUnavailableText}>Currently Occupied</Text>
          </View>
        )}
      </View>
    </View>
  );
}

function InfoRow({ label, value, star, rating, starColor, c }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: c.cardBorder }}>
      <Text style={{ color: c.textSecondary, fontSize: 13 }}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        {star && rating && <Stars rating={rating} size={13} starColor={starColor} />}
        <Text style={{ color: c.textPrimary, fontSize: 13, fontWeight: '600', maxWidth: 200, textAlign: 'right' }}>{value}</Text>
      </View>
    </View>
  );
}

function makeStyles(c) {
  return StyleSheet.create({
    center: { flex: 1, backgroundColor: c.bg, justifyContent: 'center', alignItems: 'center' },
    photo: { width, height: 240 },
    photoPlaceholder: { width, height: 200, backgroundColor: c.card, alignItems: 'center', justifyContent: 'center' },
    photoCount: {
      position: 'absolute', top: 200, right: 14,
      backgroundColor: '#000000aa', borderRadius: 12,
      paddingHorizontal: 10, paddingVertical: 4,
    },
    photoCountText: { color: '#fff', fontSize: 12 },
    body: { padding: 18 },
    headerRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10, gap: 12 },
    title: { fontSize: 22, fontWeight: '800', color: c.textPrimary, marginBottom: 4 },
    location: { fontSize: 13, color: c.textSecondary },
    priceBadge: { backgroundColor: c.primaryDim, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 },
    priceText: { color: c.primary, fontWeight: '800', fontSize: 14 },
    availBadge: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 16,
    },
    availDot: { width: 8, height: 8, borderRadius: 4 },
    availText: { fontSize: 13, fontWeight: '600' },
    infoTable: {
      backgroundColor: c.card, borderColor: c.cardBorder,
      borderWidth: 1, borderRadius: 14, overflow: 'hidden', marginBottom: 16,
    },
    hostCard: {
      backgroundColor: c.card, borderColor: c.cardBorder, borderWidth: 1,
      borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'center',
      gap: 12, marginBottom: 20,
    },
    hostAvatar: {
      width: 44, height: 44, borderRadius: 22,
      backgroundColor: c.primaryDim, borderColor: c.primary, borderWidth: 1.5,
      alignItems: 'center', justifyContent: 'center',
    },
    hostAvatarText: { fontSize: 18, fontWeight: '700', color: c.primary },
    hostLabel: { fontSize: 11, color: c.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
    hostName: { fontSize: 15, fontWeight: '700', color: c.textPrimary },
    sectionLabel: { fontSize: 13, color: c.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 },
    reviewCard: {
      backgroundColor: c.card, borderColor: c.cardBorder, borderWidth: 1,
      borderRadius: 12, padding: 14, marginBottom: 8,
    },
    reviewHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
    reviewerName: { color: c.textPrimary, fontWeight: '600', fontSize: 14 },
    reviewComment: { color: c.textSecondary, fontSize: 13, lineHeight: 20 },
    ctaBar: {
      position: 'absolute', bottom: 0, left: 0, right: 0,
      backgroundColor: c.card, borderTopWidth: 1, borderTopColor: c.cardBorder,
      flexDirection: 'row', alignItems: 'center', gap: 10,
      paddingHorizontal: 16, paddingVertical: 14,
    },
    navigateBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      borderWidth: 1.5, borderColor: c.cardBorder, borderRadius: 14,
      paddingVertical: 13, paddingHorizontal: 18,
    },
    navigateIcon: { fontSize: 16 },
    navigateText: { color: c.textPrimary, fontWeight: '700', fontSize: 15 },
    cta: { flex: 1, backgroundColor: c.primary, borderRadius: 14, paddingVertical: 13, alignItems: 'center' },
    ctaText: { color: '#000', fontWeight: '800', fontSize: 15 },
    ctaUnavailable: {
      flex: 1, borderRadius: 14, paddingVertical: 13, alignItems: 'center',
      backgroundColor: c.danger + '22', borderWidth: 1, borderColor: c.danger + '44',
    },
    ctaUnavailableText: { color: c.danger, fontWeight: '700', fontSize: 14 },
  });
}
