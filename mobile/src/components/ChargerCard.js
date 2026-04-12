import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors } from '../constants/colors';

function Stars({ rating }) {
  const full = Math.floor(rating);
  const stars = '★'.repeat(full) + '☆'.repeat(5 - full);
  return <Text style={styles.stars}>{stars}</Text>;
}

export default function ChargerCard({ charger, onPress }) {
  const distKm = charger.distance_m ? (charger.distance_m / 1000).toFixed(1) : null;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.75}>
      <View style={styles.row}>
        <View style={styles.titleCol}>
          <Text style={styles.title} numberOfLines={1}>{charger.title}</Text>
          <Text style={styles.location}>
            {distKm ? `${distKm} km · ` : ''}{charger.city || charger.address || ''}
          </Text>
        </View>
        <View style={styles.priceBadge}>
          <Text style={styles.priceText}>₹{charger.price_per_kwh}/unit</Text>
        </View>
      </View>

      <View style={styles.tagsRow}>
        {charger.average_rating != null && (
          <>
            <Stars rating={parseFloat(charger.average_rating)} />
            <Text style={styles.ratingNum}>{charger.average_rating}</Text>
          </>
        )}
        {charger.connector_types?.map((ct) => (
          <View key={ct} style={styles.tag}>
            <Text style={styles.tagText}>{ct}</Text>
          </View>
        ))}
        <View style={styles.tag}>
          <Text style={styles.tagText}>{charger.power_kw} kW</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 10,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  titleCol: { flex: 1, marginRight: 12 },
  title: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, marginBottom: 3 },
  location: { fontSize: 13, color: colors.textSecondary },
  priceBadge: {
    backgroundColor: colors.primaryDim,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  priceText: { color: colors.primary, fontWeight: '700', fontSize: 13 },
  tagsRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  stars: { color: colors.star, fontSize: 13, letterSpacing: 1 },
  ratingNum: { color: colors.textSecondary, fontSize: 13, marginRight: 4 },
  tag: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  tagText: { color: colors.textSecondary, fontSize: 12 },
});
