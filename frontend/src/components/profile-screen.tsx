import Ionicons from "@react-native-vector-icons/ionicons";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import React from "react";
import { ScrollView, Switch, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, User } from "@/src/api/client";
import { useToast } from "@/src/components/toast";
import { Button, Card, ScreenHeader, SectionTitle } from "@/src/components/ui";
import { useAuth } from "@/src/context/auth";
import { usesNativeTabs } from "@/src/navigation";
import { makeStyles, useTheme } from "@/src/theme";

const PRIVACY = [
  { icon: "finger-print", text: "Welfare officers see only your anonymised ID, never your name." },
  { icon: "lock-closed", text: "Responses are encrypted at rest and in transit." },
  { icon: "hand-left", text: "Insights are for welfare support only — never disciplinary action." },
  { icon: "people", text: "High-risk indicators are reviewed by a qualified human counsellor." },
];

export function ProfileScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const { user, logout, setUser } = useAuth();
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;

  const consent = useMutation({
    mutationFn: (value: boolean) => api<User>("/auth/consent", { method: "PUT", body: { consent: value } }),
    onSuccess: (u) => {
      setUser(u);
      toast.show(u.consent ? "Consent enabled" : "Consent withdrawn — analysis paused", "success");
    },
    onError: (e: any) => toast.show(e.message, "error"),
  });

  const isTherapist = user?.role === "therapist";
  const initials = (user?.name ?? "?").split(" ").map((p) => p[0]).slice(-2).join("").toUpperCase();

  return (
    <View style={[styles.root, { paddingTop: insets.top }]} testID="profile-screen">
      <ScreenHeader title="Profile" subtitle="Account, consent & privacy" />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomChrome + 24 }]} showsVerticalScrollIndicator={false}>
        <Card testID="profile-card">
          <View style={styles.userRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name} testID="profile-name">{user?.name}</Text>
              <Text style={styles.meta} testID="profile-identifier">{isTherapist ? user?.email : user?.service_id}</Text>
              {user?.unit ? <Text style={styles.meta}>{user.unit}</Text> : null}
            </View>
            <View style={styles.roleChip}>
              <Text style={styles.roleText}>{isTherapist ? "Therapist" : "Personnel"}</Text>
            </View>
          </View>
          {!isTherapist ? (
            <View style={styles.anonRow}>
              <Ionicons name="finger-print" size={16} color={colors.brandSecondary} />
              <Text style={styles.anonText}>Anonymised ID shown to welfare officers: <Text style={{ fontWeight: "600" }}>{user?.anon_id}</Text></Text>
            </View>
          ) : null}
        </Card>

        {!isTherapist ? (
          <Card testID="profile-consent-card">
            <View style={styles.consentRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.consentTitle}>Data analysis consent</Text>
                <Text style={styles.consentBody}>Allow Mind Well to analyse my voluntary wellness responses and wearable signals.</Text>
              </View>
              <Switch
                testID="profile-consent-switch"
                value={!!user?.consent}
                onValueChange={(v) => consent.mutate(v)}
                trackColor={{ true: colors.success, false: colors.borderStrong }}
                thumbColor={colors.surfaceSecondary}
              />
            </View>
          </Card>
        ) : null}

        <SectionTitle title="Privacy framework" />
        <Card style={{ gap: 14 }} testID="profile-privacy-card">
          {PRIVACY.map((p) => (
            <View key={p.text} style={styles.privacyRow}>
              <View style={styles.privacyIcon}>
                <Ionicons name={p.icon as any} size={16} color={colors.brandPrimary} />
              </View>
              <Text style={styles.privacyText}>{p.text}</Text>
            </View>
          ))}
        </Card>

        <Card style={{ gap: 6 }} testID="profile-about-card">
          <Text style={styles.aboutTitle}>About Mind Well</Text>
          <Text style={styles.aboutBody}>
            Prototype for SIH 2026 · PS 26186 (MHA / CRPF). Data → AI prediction → risk identification → support → counselling → follow-up.
          </Text>
          <Text style={styles.aboutBody}>Emergency: Tele-MANAS 14416 (24×7)</Text>
        </Card>

        <Button
          title="Sign out"
          variant="ghost"
          icon="log-out-outline"
          onPress={async () => {
            await logout();
            router.replace("/(auth)/login");
          }}
          testID="profile-logout-button"
        />
      </ScrollView>
    </View>
  );
}

export default ProfileScreen;

const useStyles = makeStyles((colors) => ({
  root: { flex: 1, backgroundColor: colors.surface },
  content: { paddingHorizontal: 16, gap: 16 },
  userRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  avatarText: { color: colors.onBrandPrimary, fontSize: 20, fontWeight: "600" },
  name: { fontSize: 17, fontWeight: "600", color: colors.onSurface },
  meta: { fontSize: 13, color: colors.muted, marginTop: 2 },
  roleChip: { backgroundColor: colors.brandTertiary, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  roleText: { fontSize: 12, fontWeight: "600", color: colors.onBrandTertiary },
  anonRow: { flexDirection: "row", gap: 8, alignItems: "center", marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: colors.divider },
  anonText: { flex: 1, fontSize: 13, color: colors.onSurface },
  consentRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  consentTitle: { fontSize: 15, fontWeight: "600", color: colors.onSurface },
  consentBody: { fontSize: 13, color: colors.muted, lineHeight: 18, marginTop: 4 },
  privacyRow: { flexDirection: "row", gap: 12, alignItems: "center" },
  privacyIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  privacyText: { flex: 1, fontSize: 14, color: colors.onSurface, lineHeight: 20 },
  aboutTitle: { fontSize: 15, fontWeight: "600", color: colors.onSurface },
  aboutBody: { fontSize: 13, color: colors.muted, lineHeight: 18 },
}));
