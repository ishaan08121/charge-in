import React, { useState } from 'react';
import {
  Modal, View, Text, TouchableOpacity, StyleSheet,
  ScrollView, Pressable,
} from 'react-native';
import { useColors } from '../constants/colors';
import { useChargerStore } from '../store/chargerStore';

const CONNECTORS = [
  { label: 'All', value: null },
  { label: 'AC', value: 'AC' },
  { label: 'DC', value: 'DC' },
];

const RADII = [
  { label: '5km', value: 5 },
  { label: '10km', value: 10 },
  { label: '20km', value: 20 },
  { label: '50km', value: 50 },
];

const RATINGS = [1, 2, 3, 4, 5];

export default function FilterModal({ visible, onClose, onApply }) {
  const c = useColors();
  const { connectorFilter, radiusKm, minRating, setFilter } = useChargerStore();

  const [localConnector, setLocalConnector] = useState(connectorFilter);
  const [localRadius, setLocalRadius] = useState(radiusKm);
  const [localRating, setLocalRating] = useState(minRating);

  function handleApply() {
    setFilter('connectorFilter', localConnector);
    setFilter('radiusKm', localRadius);
    setFilter('minRating', localRating);
    onApply?.();
    onClose();
  }

  function handleReset() {
    setLocalConnector(null);
    setLocalRadius(10);
    setLocalRating(null);
  }

  const s = makeStyles(c);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.overlay} onPress={onClose} />
      <View style={s.sheet}>
        {/* Handle */}
        <View style={s.handleRow}>
          <View style={s.handle} />
        </View>

        <View style={s.titleRow}>
          <Text style={s.title}>Filters</Text>
          <TouchableOpacity onPress={onClose} hitSlop={12}>
            <Text style={s.closeX}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.body}>

          {/* Connector Type */}
          <Text style={s.sectionLabel}>Connector Type</Text>
          <View style={s.pillRow}>
            {CONNECTORS.map((cn) => {
              const active = localConnector === cn.value;
              return (
                <TouchableOpacity
                  key={cn.label}
                  style={[s.pill, active && s.pillActive]}
                  onPress={() => setLocalConnector(cn.value)}
                  activeOpacity={0.75}
                >
                  <Text style={[s.pillText, active && s.pillTextActive]}>{cn.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Radius */}
          <Text style={s.sectionLabel}>Distance</Text>
          <View style={s.segmentRow}>
            {RADII.map((r) => {
              const active = localRadius === r.value;
              return (
                <TouchableOpacity
                  key={r.value}
                  style={[s.segment, active && s.segmentActive]}
                  onPress={() => setLocalRadius(r.value)}
                  activeOpacity={0.75}
                >
                  <Text style={[s.segmentText, active && s.segmentTextActive]}>{r.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Rating */}
          <Text style={s.sectionLabel}>Minimum Rating</Text>
          <View style={s.ratingRow}>
            <TouchableOpacity
              style={[s.ratingClear, localRating === null && s.ratingClearActive]}
              onPress={() => setLocalRating(null)}
            >
              <Text style={[s.ratingClearText, localRating === null && s.ratingClearTextActive]}>Any</Text>
            </TouchableOpacity>
            {RATINGS.map((r) => {
              const active = localRating === r;
              return (
                <TouchableOpacity
                  key={r}
                  style={[s.starBtn, active && s.starBtnActive]}
                  onPress={() => setLocalRating(r)}
                  activeOpacity={0.75}
                >
                  <Text style={[s.starText, active && s.starTextActive]}>{'★'.repeat(r)}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

        </ScrollView>

        {/* Actions */}
        <View style={s.actions}>
          <TouchableOpacity style={s.resetBtn} onPress={handleReset}>
            <Text style={s.resetText}>Reset</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.applyBtn} onPress={handleApply}>
            <Text style={s.applyText}>Apply Filters</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function makeStyles(c) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: c.modalOverlay,
    },
    sheet: {
      backgroundColor: c.sheetBg,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingBottom: 28,
      maxHeight: '78%',
    },
    handleRow: { alignItems: 'center', paddingTop: 10 },
    handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: c.cardBorder },
    titleRow: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      paddingHorizontal: 20, paddingVertical: 14,
      borderBottomWidth: 1, borderColor: c.cardBorder,
    },
    title: { fontSize: 17, fontWeight: '700', color: c.textPrimary },
    closeX: { fontSize: 16, color: c.textMuted, fontWeight: '600' },

    body: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8 },

    sectionLabel: {
      fontSize: 12, fontWeight: '700', color: c.textMuted,
      textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12, marginTop: 8,
    },

    pillRow: { flexDirection: 'row', gap: 10, marginBottom: 20, flexWrap: 'wrap' },
    pill: {
      paddingHorizontal: 20, paddingVertical: 9,
      borderRadius: 24, borderWidth: 1.5,
      borderColor: c.cardBorder, backgroundColor: c.card,
    },
    pillActive: { borderColor: c.primary, backgroundColor: c.primaryDim },
    pillText: { fontSize: 14, fontWeight: '600', color: c.textSecondary },
    pillTextActive: { color: c.primary },

    segmentRow: {
      flexDirection: 'row', borderRadius: 14, overflow: 'hidden',
      borderWidth: 1.5, borderColor: c.cardBorder, marginBottom: 20,
    },
    segment: {
      flex: 1, paddingVertical: 10, alignItems: 'center',
      backgroundColor: c.card,
    },
    segmentActive: { backgroundColor: c.primary },
    segmentText: { fontSize: 13, fontWeight: '600', color: c.textSecondary },
    segmentTextActive: { color: '#000' },

    ratingRow: { flexDirection: 'row', gap: 8, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' },
    ratingClear: {
      paddingHorizontal: 14, paddingVertical: 8,
      borderRadius: 20, borderWidth: 1.5, borderColor: c.cardBorder,
      backgroundColor: c.card,
    },
    ratingClearActive: { borderColor: c.primary, backgroundColor: c.primaryDim },
    ratingClearText: { fontSize: 13, fontWeight: '600', color: c.textSecondary },
    ratingClearTextActive: { color: c.primary },
    starBtn: {
      paddingHorizontal: 12, paddingVertical: 8,
      borderRadius: 20, borderWidth: 1.5, borderColor: c.cardBorder,
      backgroundColor: c.card,
    },
    starBtnActive: { borderColor: c.star, backgroundColor: c.star + '22' },
    starText: { fontSize: 13, color: c.textMuted },
    starTextActive: { color: c.star },

    actions: {
      flexDirection: 'row', gap: 12,
      paddingHorizontal: 20, paddingTop: 16,
      borderTopWidth: 1, borderColor: c.cardBorder,
    },
    resetBtn: {
      flex: 1, paddingVertical: 14, borderRadius: 14, alignItems: 'center',
      borderWidth: 1.5, borderColor: c.cardBorder,
    },
    resetText: { fontSize: 15, fontWeight: '600', color: c.textSecondary },
    applyBtn: {
      flex: 2, paddingVertical: 14, borderRadius: 14, alignItems: 'center',
      backgroundColor: c.primary,
    },
    applyText: { fontSize: 15, fontWeight: '700', color: '#000' },
  });
}
