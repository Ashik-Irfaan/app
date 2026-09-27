import Ionicons from "@react-native-vector-icons/ionicons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Platform, Pressable, Text, TextInput, View } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import Animated, { FadeInDown, FadeInRight } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Role } from "@/src/api/client";
import { Button, haptic } from "@/src/components/ui";
import { useAuth } from "@/src/context/auth";
import { makeStyles, useTheme } from "@/src/theme";

const HERO = "https://images.unsplash.com/photo-1669295384050-a1d4357bd1d7?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200";

export default function LoginScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { login } = useAuth();

  const [role, setRole] = useState<Role>("personnel");
  const [step, setStep] = useState<1 | 2>(1);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isPersonnel = role === "personnel";

  const next = () => {
    if (identifier.trim().length < 3) {
      setError(isPersonnel ? "Enter your Service ID" : "Enter your email address");
      return;
    }
    setError(null);
    setStep(2);
  };

  const submit = async () => {
    if (password.length < 6) {
      setError("Enter your password");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const u = await login(identifier.trim(), password, role);
      haptic("success");
      router.replace(u.role === "therapist" ? "/(therapist)" : "/(personnel)");
    } catch (e: any) {
      haptic("error");
      setError(e?.message ?? "Sign-in failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.root} testID="login-screen">
      <View style={styles.hero}>
        <Image source={{ uri: HERO }} style={styles.heroImg} contentFit="cover" transition={300} />
        <LinearGradient colors={["transparent", colors.scrim, colors.brandPrimary]} locations={[0, 0.55, 1]} style={styles.heroImg} />
        <View style={[styles.heroContent, { paddingTop: insets.top + 24 }]}>
          <View style={styles.logoRow}>
            <View style={styles.logoBadge}>
              <Ionicons name="shield-checkmark" size={22} color={colors.onBrandPrimary} />
            </View>
            <Text style={styles.brand}>Mind Well</Text>
          </View>
          <Text style={styles.tagline}>Predictive stress & welfare monitoring for uniformed forces</Text>
        </View>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={16}
        style={styles.sheet}
      >
        <View style={[styles.form, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.segment} testID="role-segment">
            {(["personnel", "therapist"] as Role[]).map((r) => (
              <Pressable
                key={r}
                testID={`role-${r}-button`}
                onPress={() => {
                  haptic("select");
                  setRole(r);
                  setStep(1);
                  setError(null);
                }}
                style={[styles.segmentItem, role === r && styles.segmentActive]}
              >
                <Ionicons name={r === "personnel" ? "person" : "medkit"} size={16} color={role === r ? colors.onBrandPrimary : colors.muted} />
                <Text style={[styles.segmentText, role === r && styles.segmentTextActive]}>{r === "personnel" ? "Personnel" : "Therapist"}</Text>
              </Pressable>
            ))}
          </View>

          {step === 1 ? (
            <Animated.View entering={FadeInDown.duration(300)} key="s1">
              <Text style={styles.label}>{isPersonnel ? "Service ID" : "Email address"}</Text>
              <View style={styles.inputRow}>
                <Ionicons name={isPersonnel ? "id-card-outline" : "mail-outline"} size={20} color={colors.muted} />
                <TextInput
                  testID="login-identifier-input"
                  value={identifier}
                  onChangeText={setIdentifier}
                  placeholder={isPersonnel ? "e.g. CRPF-1001" : "you@organisation.in"}
                  placeholderTextColor={colors.muted}
                  autoCapitalize={isPersonnel ? "characters" : "none"}
                  keyboardType={isPersonnel ? "default" : "email-address"}
                  autoCorrect={false}
                  returnKeyType="next"
                  onSubmitEditing={next}
                  style={styles.input}
                />
              </View>
              {isPersonnel ? (
                <View style={styles.secureNote}>
                  <Ionicons name="lock-closed" size={13} color={colors.success} />
                  <Text style={styles.secureText}>Verified against the force personnel registry. Data is encrypted end-to-end.</Text>
                </View>
              ) : null}
              {error ? <Text style={styles.error} testID="login-error">{error}</Text> : null}
              <Button title="Continue" onPress={next} icon="arrow-forward" testID="login-continue-button" style={{ marginTop: 16 }} />
            </Animated.View>
          ) : (
            <Animated.View entering={FadeInRight.duration(300)} key="s2">
              <Pressable onPress={() => setStep(1)} style={styles.identChip} testID="login-change-identifier">
                <Ionicons name={isPersonnel ? "id-card" : "mail"} size={16} color={colors.brandPrimary} />
                <Text style={styles.identText}>{identifier}</Text>
                <Text style={styles.changeText}>Change</Text>
              </Pressable>
              <Text style={styles.label}>Password</Text>
              <View style={styles.inputRow}>
                <Ionicons name="key-outline" size={20} color={colors.muted} />
                <TextInput
                  testID="login-password-input"
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Enter password"
                  placeholderTextColor={colors.muted}
                  secureTextEntry={!showPw}
                  autoFocus
                  returnKeyType="go"
                  onSubmitEditing={submit}
                  style={styles.input}
                />
                <Pressable onPress={() => setShowPw((s) => !s)} hitSlop={8} testID="toggle-password-visibility">
                  <Ionicons name={showPw ? "eye-off-outline" : "eye-outline"} size={20} color={colors.muted} />
                </Pressable>
              </View>
              {error ? <Text style={styles.error} testID="login-error">{error}</Text> : null}
              <Button title={isPersonnel ? "Secure Sign In" : "Sign In"} onPress={submit} loading={busy} icon="shield-checkmark" testID="login-submit-button" style={{ marginTop: 16 }} />
            </Animated.View>
          )}

          <Pressable onPress={() => router.push({ pathname: "/(auth)/register", params: { role } })} style={styles.registerLink} testID="go-to-register-button" hitSlop={8}>
            <Text style={styles.registerText}>
              New to Mind Well? <Text style={styles.registerStrong}>Create account</Text>
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  root: { flex: 1, backgroundColor: colors.brandPrimary },
  hero: { height: 260, position: "relative" },
  heroImg: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  heroContent: { flex: 1, paddingHorizontal: 24, justifyContent: "flex-end", paddingBottom: 28, gap: 10 },
  logoRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  logoBadge: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.overlay, alignItems: "center", justifyContent: "center" },
  brand: { color: colors.onBrandPrimary, fontSize: 28, fontWeight: "600", letterSpacing: 0.5 },
  tagline: { color: colors.onBrandPrimary, opacity: 0.85, fontSize: 14, lineHeight: 20, maxWidth: 320 },
  sheet: { flex: 1 },
  form: {
    flex: 1,
    backgroundColor: colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 20,
    gap: 4,
  },
  segment: { flexDirection: "row", backgroundColor: colors.surfaceTertiary, borderRadius: 999, padding: 4, marginBottom: 20 },
  segmentItem: { flex: 1, flexDirection: "row", gap: 6, alignItems: "center", justifyContent: "center", height: 40, borderRadius: 999 },
  segmentActive: { backgroundColor: colors.brandPrimary },
  segmentText: { fontSize: 14, fontWeight: "500", color: colors.muted },
  segmentTextActive: { color: colors.onBrandPrimary },
  label: { fontSize: 13, color: colors.muted, marginBottom: 8, fontWeight: "500" },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    height: 54,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSecondary,
    paddingHorizontal: 14,
  },
  input: { flex: 1, fontSize: 16, color: colors.onSurface, height: "100%" },
  secureNote: { flexDirection: "row", gap: 6, alignItems: "flex-start", marginTop: 10 },
  secureText: { fontSize: 12, color: colors.muted, flex: 1, lineHeight: 16 },
  error: { color: colors.error, fontSize: 13, marginTop: 10 },
  identChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    alignSelf: "flex-start",
    backgroundColor: colors.brandTertiary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    marginBottom: 16,
  },
  identText: { color: colors.onBrandTertiary, fontSize: 14, fontWeight: "500" },
  changeText: { color: colors.brandSecondary, fontSize: 13 },
  registerLink: { alignItems: "center", paddingVertical: 20, marginTop: "auto" },
  registerText: { color: colors.muted, fontSize: 14 },
  registerStrong: { color: colors.brandSecondary, fontWeight: "600" },
}));
