import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform, Alert, ScrollView,
} from 'react-native';
import { useAuthStore } from '../../store/authStore';
import { colors } from '../../constants/colors';

export default function SignupScreen({ navigation }) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { signup, login } = useAuthStore();

  async function handleSignup() {
    if (!fullName || !email || !password) {
      return Alert.alert('Error', 'Name, email and password are required');
    }
    setLoading(true);
    try {
      await signup(email.trim(), password, fullName.trim(), phone.trim() || undefined);
      // Auto-login after signup
      await login(email.trim(), password);
    } catch (err) {
      Alert.alert('Signup Failed', err.response?.data?.error || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.logo}>⚡ Charge.in</Text>
        <Text style={styles.subtitle}>Create your account</Text>

        <TextInput style={styles.input} placeholder="Full Name" placeholderTextColor={colors.textMuted}
          value={fullName} onChangeText={setFullName} />
        <TextInput style={styles.input} placeholder="Email" placeholderTextColor={colors.textMuted}
          autoCapitalize="none" keyboardType="email-address"
          value={email} onChangeText={setEmail} />
        <TextInput style={styles.input} placeholder="Phone (optional)" placeholderTextColor={colors.textMuted}
          keyboardType="phone-pad" value={phone} onChangeText={setPhone} />
        <TextInput style={styles.input} placeholder="Password" placeholderTextColor={colors.textMuted}
          secureTextEntry value={password} onChangeText={setPassword} />

        <TouchableOpacity style={styles.btn} onPress={handleSignup} disabled={loading}>
          {loading
            ? <ActivityIndicator color="#000" />
            : <Text style={styles.btnText}>Create Account</Text>}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.link}>Already have an account? <Text style={styles.linkGreen}>Login</Text></Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 28, paddingVertical: 40 },
  logo: { fontSize: 32, fontWeight: '800', color: colors.primary, textAlign: 'center', marginBottom: 6 },
  subtitle: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginBottom: 40 },
  input: {
    backgroundColor: colors.card, borderColor: colors.cardBorder, borderWidth: 1,
    borderRadius: 12, color: colors.textPrimary, paddingHorizontal: 16,
    paddingVertical: 14, marginBottom: 14, fontSize: 15,
  },
  btn: {
    backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 15,
    alignItems: 'center', marginTop: 6, marginBottom: 20,
  },
  btnText: { color: '#000', fontWeight: '700', fontSize: 16 },
  link: { textAlign: 'center', color: colors.textSecondary, fontSize: 14 },
  linkGreen: { color: colors.primary, fontWeight: '600' },
});
