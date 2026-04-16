import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Alert, ActivityIndicator, ScrollView, TextInput, Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { useAuthStore } from '../store/authStore';
import { apiGetMe, apiUpdateMe, apiUploadAvatar } from '../api/users';
import { colors } from '../constants/colors';

export default function ProfileScreen({ navigation }) {
  const { logout } = useAuthStore();
  const [profile, setProfile] = useState(null);
  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState('');
  const [upiId, setUpiId] = useState('');
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  useEffect(() => { loadProfile(); }, []);

  async function loadProfile() {
    setLoadError(false);
    try {
      const { data } = await apiGetMe();
      setProfile(data.user);
      setFullName(data.user.full_name || '');
      setUpiId(data.user.upi_id || '');
    } catch (err) {
      const msg = err?.response?.data?.error || err?.message || 'Unknown error';
      const status = err?.response?.status ? ` (${err.response.status})` : '';
      setErrorMsg(msg + status);
      setLoadError(true);
    }
  }

  async function saveProfile() {
    setSaving(true);
    try {
      const { data } = await apiUpdateMe({ full_name: fullName, upi_id: upiId });
      setProfile(data.user);
      setEditing(false);
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || 'Could not save profile');
    } finally {
      setSaving(false);
    }
  }

  async function pickPhoto() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      return Alert.alert('Permission needed', 'Allow photo access to set a profile picture.');
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.6,
    });
    if (result.canceled) return;

    setUploadingPhoto(true);
    try {
      const asset = result.assets[0];
      const jpeg = await ImageManipulator.manipulateAsync(
        asset.uri, [], { compress: 0.75, format: ImageManipulator.SaveFormat.JPEG }
      );
      const { data } = await apiUploadAvatar(jpeg.uri, 'image/jpeg');
      setProfile(p => ({ ...p, avatar_url: data.avatar_url }));
    } catch (err) {
      Alert.alert('Upload failed', err.response?.data?.error || 'Could not upload photo');
    } finally {
      setUploadingPhoto(false);
    }
  }

  function confirmLogout() {
    Alert.alert('Logout', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: logout },
    ]);
  }

  if (!profile) {
    return (
      <View style={styles.center}>
        {loadError ? (
          <>
            <Text style={{ color: colors.textSecondary, marginBottom: 8 }}>Could not load profile</Text>
            {!!errorMsg && <Text style={{ color: colors.danger, fontSize: 12, marginBottom: 16, textAlign: 'center', paddingHorizontal: 20 }}>{errorMsg}</Text>}
            <TouchableOpacity style={styles.btn} onPress={loadProfile}>
              <Text style={styles.btnText}>Retry</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.logoutBtn, { marginTop: 12, paddingHorizontal: 32 }]} onPress={confirmLogout}>
              <Text style={styles.logoutText}>Logout</Text>
            </TouchableOpacity>
          </>
        ) : (
          <ActivityIndicator color={colors.primary} />
        )}
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
      <Text style={styles.heading}>Profile</Text>

      {/* Avatar */}
      <TouchableOpacity style={styles.avatarWrap} onPress={pickPhoto} disabled={uploadingPhoto}>
        {profile.avatar_url ? (
          <Image source={{ uri: profile.avatar_url }} style={styles.avatarImg} />
        ) : (
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{(profile.full_name || 'U')[0].toUpperCase()}</Text>
          </View>
        )}
        <View style={styles.avatarBadge}>
          {uploadingPhoto
            ? <ActivityIndicator size="small" color="#000" />
            : <Text style={styles.avatarBadgeText}>📷</Text>}
        </View>
      </TouchableOpacity>

      {editing ? (
        <>
          <Text style={styles.label}>Full Name</Text>
          <TextInput style={styles.input} value={fullName} onChangeText={setFullName}
            placeholderTextColor={colors.textMuted} placeholder="Your name" />
          <Text style={styles.label}>UPI ID (for payouts)</Text>
          <TextInput style={styles.input} value={upiId} onChangeText={setUpiId}
            placeholder="yourname@upi" placeholderTextColor={colors.textMuted} autoCapitalize="none" />

          <TouchableOpacity style={styles.btn} onPress={saveProfile} disabled={saving}>
            {saving ? <ActivityIndicator color="#000" /> : <Text style={styles.btnText}>Save Changes</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={styles.btnOutline} onPress={() => setEditing(false)}>
            <Text style={styles.btnOutlineText}>Cancel</Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          <InfoRow label="Name" value={profile.full_name || '—'} />
          <InfoRow label="Email" value={profile.email || '—'} />
          <InfoRow label="Phone" value={profile.phone || '—'} />
          <InfoRow label="UPI ID" value={profile.upi_id || 'Not set'} />
          <InfoRow label="Account Type" value={profile.is_host ? '⚡ Host + User' : 'User'} />

          <TouchableOpacity style={styles.btn} onPress={() => setEditing(true)}>
            <Text style={styles.btnText}>Edit Profile</Text>
          </TouchableOpacity>
        </>
      )}

      {/* EV Tools */}
      <View style={styles.divider} />
      <Text style={styles.sectionLabel}>My EV</Text>

      <TouchableOpacity style={styles.hostCard} onPress={() => navigation.navigate('EVProfile')}>
        <Text style={styles.hostCardIcon}>🚗</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.hostCardTitle}>EV Profile</Text>
          <Text style={styles.hostCardSub}>Save your car details for quick auto-fill</Text>
        </View>
        <Text style={styles.chevron}>›</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.hostCard} onPress={() => navigation.navigate('ChargingCalculator')}>
        <Text style={styles.hostCardIcon}>🔋</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.hostCardTitle}>Charging Calculator</Text>
          <Text style={styles.hostCardSub}>Estimate time, cost and range for a charge</Text>
        </View>
        <Text style={styles.chevron}>›</Text>
      </TouchableOpacity>

      {/* Host section */}
      <View style={styles.divider} />
      <Text style={styles.sectionLabel}>Host Tools</Text>

      <TouchableOpacity style={styles.hostCard} onPress={() => navigation.navigate('MyChargers')}>
        <Text style={styles.hostCardIcon}>🔌</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.hostCardTitle}>My Chargers</Text>
          <Text style={styles.hostCardSub}>Manage, edit or delist your chargers</Text>
        </View>
        <Text style={styles.chevron}>›</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.hostCard} onPress={() => navigation.navigate('ListCharger')}>
        <Text style={styles.hostCardIcon}>⚡</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.hostCardTitle}>Add a Charger</Text>
          <Text style={styles.hostCardSub}>List a new charger on the network</Text>
        </View>
        <Text style={styles.chevron}>›</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.hostCard} onPress={() => navigation.navigate('BookingRequests')}>
        <Text style={styles.hostCardIcon}>📋</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.hostCardTitle}>Booking Requests</Text>
          <Text style={styles.hostCardSub}>Accept, decline, start sessions</Text>
        </View>
        <Text style={styles.chevron}>›</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.hostCard} onPress={() => navigation.navigate('Earnings')}>
        <Text style={styles.hostCardIcon}>💰</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.hostCardTitle}>Earnings Dashboard</Text>
          <Text style={styles.hostCardSub}>Track income and payouts</Text>
        </View>
        <Text style={styles.chevron}>›</Text>
      </TouchableOpacity>

      <View style={styles.divider} />

      <TouchableOpacity style={styles.logoutBtn} onPress={confirmLogout}>
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function InfoRow({ label, value }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' },
  heading: { fontSize: 22, fontWeight: '800', color: colors.textPrimary, marginBottom: 20 },
  avatarWrap: { alignSelf: 'center', marginBottom: 24 },
  avatar: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: colors.primaryDim, borderColor: colors.primary, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarImg: { width: 80, height: 80, borderRadius: 40, borderWidth: 2, borderColor: colors.primary },
  avatarText: { fontSize: 30, fontWeight: '800', color: colors.primary },
  avatarBadge: {
    position: 'absolute', bottom: 0, right: 0,
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  avatarBadgeText: { fontSize: 13 },
  infoRow: {
    backgroundColor: colors.card, borderColor: colors.cardBorder, borderWidth: 1,
    borderRadius: 12, padding: 14, marginBottom: 8,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  infoLabel: { color: colors.textMuted, fontSize: 13 },
  infoValue: { color: colors.textPrimary, fontSize: 13, fontWeight: '600', maxWidth: '60%', textAlign: 'right' },
  label: { color: colors.textSecondary, fontSize: 13, marginBottom: 6, marginTop: 12, fontWeight: '500' },
  input: {
    backgroundColor: colors.card, borderColor: colors.cardBorder, borderWidth: 1,
    borderRadius: 12, color: colors.textPrimary, paddingHorizontal: 16,
    paddingVertical: 13, fontSize: 15, marginBottom: 4,
  },
  btn: { backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 14, marginBottom: 10 },
  btnText: { color: '#000', fontWeight: '700', fontSize: 15 },
  btnOutline: { borderColor: colors.cardBorder, borderWidth: 1, borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginBottom: 4 },
  btnOutlineText: { color: colors.textSecondary, fontWeight: '600', fontSize: 15 },
  divider: { height: 1, backgroundColor: colors.cardBorder, marginVertical: 20 },
  sectionLabel: { fontSize: 13, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 },
  hostCard: {
    backgroundColor: colors.card, borderColor: colors.cardBorder, borderWidth: 1,
    borderRadius: 14, padding: 16, marginBottom: 10,
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  hostCardIcon: { fontSize: 24 },
  hostCardTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary, marginBottom: 2 },
  hostCardSub: { fontSize: 12, color: colors.textSecondary },
  chevron: { fontSize: 22, color: colors.textMuted },
  logoutBtn: { borderColor: colors.danger + '44', borderWidth: 1, borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
  logoutText: { color: colors.danger, fontWeight: '600', fontSize: 15 },
});
