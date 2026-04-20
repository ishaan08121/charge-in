import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { useColors } from '../constants/colors';

function Stars({ rating, starColor }) {
  const full = Math.floor(rating);
  const stars = '★'.repeat(full) + '☆'.repeat(5 - full);
  return <Text style={{ color: starColor, fontSize: 13, letterSpacing: 1 }}>{stars}</Text>;
}

export default function ChargerCard({ charger, onPress }) {
  const c = useColors();
  const s = makeStyles(c);
  const distKm = charger.distance_m ? (charger.distance_m / 1000).toFixed(1) : null;
  const photoUrl = charger.charger_photos?.[0]?.url;

  return (
    <TouchableOpacity style={s.card} onPress={onPress} activeOpacity={0.75}>
      {photoUrl && (
        <Image source={{ uri: photoUrl }} style={s.photo} resizeMode="cover" />
      )}
      <View style={s.row}>
        <View style={s.titleCol}>
          <Text style={s.title} numberOfLines={1}>{charger.title}</Text>
          <Text style={s.location}>
            {distKm ? `${distKm} km · ` : ''}{charger.city || charger.address || ''}
          </Text>
        </View>
        <View style={s.priceBadge}>
          <Text style={s.priceText}>₹{charger.price_per_kwh}/unit</Text>
        </View>
      </View>

      <View style={s.tagsRow}>
        {charger.average_rating != null && (
          <>
            <Stars rating={parseFloat(charger.average_rating)} starColor={c.star} />
            <Text style={s.ratingNum}>{charger.average_rating}</Text>
          </>
        )}
        {charger.connector_types?.map((ct) => (
          <View key={ct} style={s.tag}>
            <Text style={s.tagText}>{ct}</Text>
          </View>
        ))}
        <View style={s.tag}>
          <Text style={s.tagText}>{charger.power_kw} kW</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

function makeStyles(c) {
  return StyleSheet.create({
    card: {
      backgroundColor: c.card,
      borderColor: c.cardBorder,
      borderWidth: 1,
      borderRadius: 14,
      overflow: 'hidden',
      marginHorizontal: 16,
      marginBottom: 10,
    },
    photo: { width: '100%', height: 140 },
    row: {
      flexDirection: 'row', justifyContent: 'space-between',
      alignItems: 'flex-start', padding: 16, paddingBottom: 0,
    },
    titleCol: { flex: 1, marginRight: 12 },
    title: { fontSize: 16, fontWeight: '700', color: c.textPrimary, marginBottom: 3 },
    location: { fontSize: 13, color: c.textSecondary },
    priceBadge: {
      backgroundColor: c.primaryDim, borderRadius: 20,
      paddingHorizontal: 10, paddingVertical: 4,
    },
    priceText: { color: c.primary, fontWeight: '700', fontSize: 13 },
    tagsRow: {
      flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap',
      gap: 6, paddingHorizontal: 16, paddingBottom: 16, paddingTop: 10,
    },
    ratingNum: { color: c.textSecondary, fontSize: 13, marginRight: 4 },
    tag: {
      backgroundColor: c.surface, borderRadius: 20,
      paddingHorizontal: 10, paddingVertical: 4,
    },
    tagText: { color: c.textSecondary, fontSize: 12 },
  });
}
