import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, Image, Dimensions,
} from 'react-native';
import { apiGetCharger, apiGetReviews } from '../api/chargers';
import { colors } from '../constants/colors';

const { width } = Dimensions.get('window');

function Stars({ rating, size = 14 }) {
  const full = Math.floor(rating);
  const half = rating % 1 >= 0.5;
  return (
    <Text style={{ color: colors.star, fontSize: size }}>
      {'★'.repeat(full)}{half ? '½' : ''}{'☆'.repeat(5 - full - (half ? 1 : 0))}
    </Text>
  );
}

export default function ChargerDetailScreen({ route, navigation }) {
  const { chargerId, chargerLat, chargerLng } = route.params;
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

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={colors.primary} size="large" /></View>;
  }
  if (!charger) return null;

  const photos = charger.charger_photos || [];

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
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
            <InfoRow label="Charger type" value={`${charger.connector_types?.join(', ') || '—'} · ${charger.power_kw} kW`} />
            <InfoRow label="Connector" value={charger.connector_types?.join(', ') || '—'} />
            <InfoRow label="Rate" value={`₹${charger.price_per_kwh}/kWh`} />
            {avgRating && (
              <InfoRow
                label="Host rating"
                value={`${avgRating} (${reviews.length} review${reviews.length !== 1 ? 's' : ''})`}
                star
                rating={parseFloat(avgRating)}
              />
            )}
            {charger.description && (
              <InfoRow label="Access" value={charger.description} />
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
                    <Stars rating={r.rating} />
                  </View>
                  {r.comment && <Text style={styles.reviewComment}>{r.comment}</Text>}
                </View>
              ))}
            </>
          )}
        </View>
      </ScrollView>

      {/* Book CTA */}
      {charger.is_available && (
        <View style={styles.ctaBar}>
          <View>
            <Text style={styles.ctaPrice}>₹{charger.price_per_kwh}/kWh</Text>
            <Text style={styles.ctaSub}>{charger.power_kw} kW · {charger.connector_types?.[0]}</Text>
          </View>
          <TouchableOpacity
            style={styles.cta}
            onPress={() => navigation.navigate('BookSlot', { charger, chargerLat, chargerLng })}
          >
            <Text style={styles.ctaText}>Book a Slot</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

function InfoRow({ label, value, star, rating }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <View style={styles.infoRight}>
        {star && rating && <Stars rating={rating} size={13} />}
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' },
  photo: { width, height: 240 },
  photoPlaceholder: { width, height: 200, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  photoCount: {
    position: 'absolute', top: 200, right: 14,
    backgroundColor: '#000000aa', borderRadius: 12,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  photoCountText: { color: '#fff', fontSize: 12 },

  body: { padding: 18 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10, gap: 12 },
  title: { fontSize: 22, fontWeight: '800', color: colors.textPrimary, marginBottom: 4 },
  location: { fontSize: 13, color: colors.textSecondary },
  priceBadge: { backgroundColor: colors.primaryDim, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 },
  priceText: { color: colors.primary, fontWeight: '800', fontSize: 14 },

  availBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8,
    marginBottom: 16,
  },
  availDot: { width: 8, height: 8, borderRadius: 4 },
  availText: { fontSize: 13, fontWeight: '600' },

  infoTable: {
    backgroundColor: colors.card, borderColor: colors.cardBorder,
    borderWidth: 1, borderRadius: 14, overflow: 'hidden', marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 13,
    borderBottomWidth: 1, borderBottomColor: colors.cardBorder,
  },
  infoLabel: { color: colors.textSecondary, fontSize: 13 },
  infoRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  infoValue: { color: colors.textPrimary, fontSize: 13, fontWeight: '600', maxWidth: 200, textAlign: 'right' },

  hostCard: {
    backgroundColor: colors.card, borderColor: colors.cardBorder, borderWidth: 1,
    borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'center',
    gap: 12, marginBottom: 20,
  },
  hostAvatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.primaryDim, borderColor: colors.primary, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
  },
  hostAvatarText: { fontSize: 18, fontWeight: '700', color: colors.primary },
  hostLabel: { fontSize: 11, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  hostName: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },

  sectionLabel: { fontSize: 13, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 },
  reviewCard: {
    backgroundColor: colors.card, borderColor: colors.cardBorder, borderWidth: 1,
    borderRadius: 12, padding: 14, marginBottom: 8,
  },
  reviewHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  reviewerName: { color: colors.textPrimary, fontWeight: '600', fontSize: 14 },
  reviewComment: { color: colors.textSecondary, fontSize: 13, lineHeight: 20 },

  ctaBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.cardBorder,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
  },
  ctaPrice: { fontSize: 18, fontWeight: '800', color: colors.textPrimary },
  ctaSub: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  cta: { backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 13, paddingHorizontal: 28 },
  ctaText: { color: '#000', fontWeight: '800', fontSize: 15 },
});
