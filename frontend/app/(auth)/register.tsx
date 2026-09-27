import Ionicons from "@react-native-vector-icons/ionicons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView, KeyboardStickyView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Role } from "@/src/api/client";
import { Button, haptic, ScreenHeader } from "@/src/components/ui";
import { useAuth } from "@/src/context/auth";
import { makeStyles, useTheme } from "@/src/theme";

export default function RegisterScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ role?: string }>();
  const { register } = useAuth();

  const [role, setRole] = useState<Role>(params.role === "therapist" ? "therapist" : "personnel");
  const [name, setName] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [unit, setUnit] = useState("");
  const [password, setPassword] = useState("");
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const isPersonnel = role === "personnel";

  const submit = async () => {
    if (name.trim().length < 2) return setError("Enter your full name");
    if (identifier.trim().length < 4) return setError(isPersonnel ? "Enter a valid Service ID" : "Enter a valid email");
    if (password.length < 8) return setError("Password must be at least 8 characters");
    if (!consent) return setError("Please provide consent to continue");
    setError(null);
    setBusy(true);
    try {
      const payload: Record<string, unknown> = { role, name: name.trim(), password };
      if (isPersonnel) {
        payload.service_id = identifier.trim();
        payload.unit = unit.trim();
      } else payload.email = identifier.trim();
      const u = await register(payload);
      haptic("success");
      router.replace(u.role === "therapist" ? "/(therapist)" : "/(personnel)");
    } catch (e: any) {
      haptic("error");
      setError(e?.message ?? "Registration failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]} testID="register-screen">
      <ScreenHeader title="Create account" subtitle="Your data stays private and consent-based" onBack={() => router.back()} />
      <KeyboardAwareScrollView contentContainerStyle={styles.content} bottomOffset={120} keyboardShouldPersistTaps="handled">
        <View style={styles.segment}>
          {(["personnel", "therapist"] as Role[]).map((r) => (
            <Pressable key={r} testID={`register-role-${r}`} onPress={() => setRole(r)} style={[styles.segmentItem, role === r && styles.segmentActive]}>
              <Text style={[styles.segmentText, role === r && styles.segmentTextActive]}>{r === "personnel" ? "Personnel" : "Therapist"}</Text>
            </Pressable>
          ))}
        </View>

        <Field label="Full name" icon="person-outline">
          <TextInput testID="register-name-input" value={name} onChangeText={setName} placeholder="Rank and name" placeholderTextColor={colors.muted} style={styles.input} />
        </Field>
        <Field label={isPersonnel ? "Service ID" : "Email address"} icon={isPersonnel ? "id-card-outline" : "mail-outline"}>
          <TextInput
            testID="register-identifier-input"
            value={identifier}
            onChangeText={setIdentifier}
            placeholder={isPersonnel ? "e.g. CRPF-2045" : "you@organisation.in"}
            placeholderTextColor={colors.muted}
            autoCapitalize={isPersonnel ? "characters" : "none"}
            keyboardType={isPersonnel ? "default" : "email-address"}
            autoCorrect={false}
            style={styles.input}
          />
        </Field>
        {isPersonnel ? (
          <Field label="Unit / Battalion" icon="flag-outline">
            <TextInput testID="register-unit-input" value={unit} onChangeText={setUnit} placeholder="e.g. 112 Bn CRPF" placeholderTextColor={colors.muted} style={styles.input} />
          </Field>
        ) : null}
        <Field label="Password" icon="key-outline">
          <TextInput testID="register-password-input" value={password} onChangeText={setPassword} placeholder="Minimum 8 characters" placeholderTextColor={colors.muted} secureTextEntry style={styles.input} />
        </Field>

        <Pressable onPress={() => setConsent((c) => !c)} style={styles.consentRow} testID="register-consent-checkbox">
          <Ionicons name={consent ? "checkbox" : "square-outline"} size={24} color={consent ? colors.success : colors.muted} />
          <Text style={styles.consentText}>
            I consent to Mind Well analysing my voluntary wellness responses to provide welfare support. My identity is anonymised for welfare officers and never used for disciplinary action.
          </Text>
        </Pressable>
        {error ? <Text style={styles.error} testID="register-error">{error}</Text> : null}
      </KeyboardAwareScrollView>
      <KeyboardStickyView offset={{ closed: 0, opened: insets.bottom }}>
        <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
          <Button title="Create account" onPress={submit} loading={busy} testID="register-submit-button" />
        </View>
      </KeyboardStickyView>
    </View>
  );
}

function Field({ label, icon, children }: { label: string; icon: string; children: React.ReactNode }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputRow}>
        <Ionicons name={icon as any} size={20} color={colors.muted} />
        {children}
      </View>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  root: { flex: 1, backgroundColor: colors.surface },
  content: { paddingHorizontal: 24, paddingBottom: 24, gap: 16 },
  segment: { flexDirection: "row", backgroundColor: colors.surfaceTertiary, borderRadius: 999, padding: 4 },
  segmentItem: { flex: 1, alignItems: "center", justifyContent: "center", height: 40, borderRadius: 999 },
  segmentActive: { backgroundColor: colors.brandPrimary },
  segmentText: { fontSize: 14, fontWeight: "500", color: colors.muted },
  segmentTextActive: { color: colors.onBrandPrimary },
  field: { gap: 8 },
  label: { fontSize: 13, color: colors.muted, fontWeight: "500" },
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
  consentRow: { flexDirection: "row", gap: 12, alignItems: "flex-start", backgroundColor: colors.brandTertiary, padding: 14, borderRadius: 12 },
  consentText: { flex: 1, fontSize: 13, lineHeight: 18, color: colors.onBrandTertiary },
  error: { color: colors.error, fontSize: 13 },
  footer: { paddingHorizontal: 24, paddingTop: 12, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.divider },
}));
