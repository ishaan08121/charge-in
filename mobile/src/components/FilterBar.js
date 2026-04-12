import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { colors } from '../constants/colors';
import { useChargerStore } from '../store/chargerStore';

const CONNECTORS = [
  { label: 'AC / DC', value: null },
  { label: 'AC', value: 'AC' },
  { label: 'DC', value: 'DC' },
];

const RADII = [
  { label: 'Within 5km', value: 5 },
  { label: 'Within 10km', value: 10 },
  { label: 'Within 20km', value: 20 },
];

const RATINGS = [
  { label: 'Any Rating', value: null },
  { label: 'Rating 4+', value: 4 },
];

export default function FilterBar({ onFilterChange }) {
  const { connectorFilter, radiusKm, minRating, setFilter } = useChargerStore();

  function apply(key, value) {
    setFilter(key, value);
    onFilterChange?.();
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.bar}
      contentContainerStyle={styles.content}
    >
      {CONNECTORS.map((c) => (
        <Chip
          key={c.label}
          label={c.label}
          active={connectorFilter === c.value}
          onPress={() => apply('connectorFilter', c.value)}
        />
      ))}
      {RADII.map((r) => (
        <Chip
          key={r.label}
          label={r.label}
          active={radiusKm === r.value}
          onPress={() => apply('radiusKm', r.value)}
        />
      ))}
      {RATINGS.map((r) => (
        <Chip
          key={r.label}
          label={r.label}
          active={minRating === r.value}
          onPress={() => apply('minRating', r.value)}
        />
      ))}
    </ScrollView>
  );
}

function Chip({ label, active, onPress }) {
  return (
    <TouchableOpacity
      style={[styles.chip, active && styles.chipActive]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  bar: { flexGrow: 0, flexShrink: 0 },
  content: { paddingHorizontal: 16, paddingVertical: 8, flexDirection: 'row', alignItems: 'center' },
  chip: {
    backgroundColor: colors.filterBg,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 8,
  },
  chipActive: { backgroundColor: colors.filterActiveBg, borderColor: colors.primary },
  chipText: { color: colors.textSecondary, fontSize: 13, fontWeight: '500' },
  chipTextActive: { color: colors.primary },
});
