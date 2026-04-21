import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useColors } from '../constants/colors';

export default function BookingConfirmedScreen({ route, navigation }) {
  const colors = useColors();
  const styles = makeStyles(colors);
  const { booking } = route.params;

  return (
    <View style={styles.container}>
      <Text style={styles.icon}>✅</Text>
      <Text style={styles.title}>Booking Submitted!</Text>
      <Text style={styles.sub}>Waiting for host to confirm your booking.</Text>
      <Text style={styles.sub2}>You will receive a notification once confirmed.</Text>

      <View style={styles.otpBox}>
        <Text style={styles.otpLabel}>Your Session OTP</Text>
        <Text style={styles.otp}>{booking?.otp || '----'}</Text>
        <Text style={styles.otpHint}>Show this to the host when you arrive to start charging</Text>
      </View>

      <TouchableOpacity
        style={styles.btn}
        onPress={() => {
          // Switch to BookingsTab (different tab stack)
          navigation.getParent()?.getParent()?.navigate('BookingsTab');
        }}
      >
        <Text style={styles.btnText}>View My Bookings</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.btnOutline}
        onPress={() => navigation.popToTop()}
      >
        <Text style={styles.btnOutlineText}>Back to Map</Text>
      </TouchableOpacity>
    </View>
  );
}

function makeStyles(c) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center', padding: 32 },
  icon: { fontSize: 56, marginBottom: 16 },
  title: { fontSize: 26, fontWeight: '800', color: c.textPrimary, marginBottom: 8, textAlign: 'center' },
  sub: { fontSize: 15, color: c.textSecondary, textAlign: 'center', marginBottom: 4 },
  sub2: { fontSize: 13, color: c.textMuted, textAlign: 'center', marginBottom: 30 },
  otpBox: {
    backgroundColor: c.card, borderColor: c.primary, borderWidth: 1.5,
    borderRadius: 16, padding: 20, alignItems: 'center', width: '100%', marginBottom: 28,
  },
  otpLabel: { fontSize: 12, color: c.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
  otp: { fontSize: 48, fontWeight: '900', color: c.primary, letterSpacing: 8 },
  otpHint: { fontSize: 12, color: c.textSecondary, textAlign: 'center', marginTop: 8 },
  btn: { backgroundColor: c.primary, borderRadius: 14, paddingVertical: 15, width: '100%', alignItems: 'center', marginBottom: 12 },
  btnText: { color: '#000', fontWeight: '700', fontSize: 15 },
  btnOutline: { borderColor: c.cardBorder, borderWidth: 1, borderRadius: 14, paddingVertical: 15, width: '100%', alignItems: 'center' },
  btnOutlineText: { color: c.textSecondary, fontWeight: '600', fontSize: 15 },
});
}
