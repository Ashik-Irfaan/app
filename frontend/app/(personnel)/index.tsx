import Ionicons from "@react-native-vector-icons/ionicons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import React from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, Dashboard } from "@/src/api/client";
import { StressChart } from "@/src/components/stress-chart";
import { useToast } from "@/src/components/toast";
import { Button, Card, EmptyState, riskColor, riskLabel, riskSoft, SectionTitle } from "@/src/components/ui";
import { useAuth } from "@/src/context/auth";
import { usesNativeTabs } from "@/src/navigation";
import { makeStyles, useTheme } from "@/src/theme";

export default function HomeScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => api<Dashboard>("/dashboard"),
  });

  const support = useMutation({
    mutationFn: () => api<{ ok: boolean; already_open: boolean }>("/support/request", { method: "POST" }),
    onSuccess: (r) => {
      toast.show(r.already_open ? "A counsellor is already assigned to you" : "A counsellor will reach out to you confidentially", "success");
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e: any) => toast.show(e.message, "error"),
  });

  const latest = data?.latest ?? null;
  const level = latest?.level ?? null;
  const accent = riskColor(level ?? "low", colors);
  const firstName = user?.name?.split(" ").slice(-2).join(" ") ?? "";

  return (
    <View style={styles.root} testID="personnel-home">
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.greet}>Welcome back,</Text>
          <Text style={styles.name} testID="home-user-name">{firstName}</Text>
        </View>
        <View style={styles.anonChip} testID="home-anon-id">
          <Ionicons name="finger-print" size={14} color={colors.brandSecondary} />
          <Text style={styles.anonText}>{user?.anon_id}</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: bottomChrome + 24 }]}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.brandPrimary} />}
        showsVerticalScrollIndicator={false}
      >
        {isLoading ? (
          <View style={styles.loading} testID="home-loading">
            <ActivityIndicator color={colors.brandPrimary} />
          </View>
        ) : isError ? (
          <Card>
            <EmptyState icon="cloud-offline-outline" title="Couldn't load your dashboard" body="Check your connection and try again." />
            <Button title="Retry" variant="secondary" onPress={() => refetch()} testID="home-retry-button" />
          </Card>
        ) : (
          <>
            {level === "high" ? (
              <Animated.View entering={FadeInDown.duration(400)}>
                <View style={styles.attention} testID="home-attention-banner">
                  <Ionicons name="warning" size={20} color={colors.error} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.attentionTitle}>Attention</Text>
                    <Text style={styles.attentionBody}>Your recent wellness indicators suggest that additional support may be helpful. You are not alone.</Text>
                  </View>
                </View>
              </Animated.View>
            ) : null}

            <Animated.View entering={FadeInDown.delay(80).duration(400)}>
              <View style={[styles.heroCard, { backgroundColor: colors.brandPrimary }]} testID="home-risk-card">
                <View style={styles.heroTop}>
                  <View>
                    <Text style={styles.heroLabel}>WELLNESS STATUS</Text>
                    <Text style={styles.heroTitle}>Stress risk level</Text>
                  </View>
                  <Ionicons name="pulse" size={22} color={colors.onBrandPrimary} />
                </View>
                <View style={styles.heroBody}>
                  <View style={[styles.ring, { borderColor: accent }]}>
                    <Text style={[styles.ringScore, { color: colors.onBrandPrimary }]} testID="home-risk-score">{latest ? Math.round(latest.score) : "--"}</Text>
                    <Text style={styles.ringSub}>/100</Text>
                  </View>
                  <View style={{ flex: 1, gap: 6 }}>
                    <View style={[styles.levelPill, { backgroundColor: accent }]}>
                      <Text style={styles.levelText} testID="home-risk-level">{latest ? riskLabel(level).toUpperCase() : "NO DATA"}</Text>
                    </View>
                    <Text style={styles.heroHint}>
                      {latest
                        ? `Last check-in ${new Date(latest.created_at).toLocaleDateString(undefined, { day: "numeric", month: "short" })}`
                        : "Take your first wellness check"}
                    </Text>
                    {data?.wearable?.reading ? (
                      <View style={styles.hrRow}>
                        <Ionicons name="heart" size={14} color={colors.error} />
                        <Text style={styles.hrText} testID="home-heart-rate">{data.wearable.reading.heart_rate} bpm · {data.wearable.device}</Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              </View>
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(160).duration(400)}>
              <Card testID="home-history-card">
                <SectionTitle title="Stress history" />
                {data && data.history.length > 1 ? (
                  <StressChart history={data.history} testID="home-stress-chart" />
                ) : (
                  <EmptyState icon="analytics-outline" title="Your trend appears here" body="Complete at least two wellness checks to see your stress history." testID="home-history-empty" />
                )}
              </Card>
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(240).duration(400)}>
              <SectionTitle title="Today's wellness" />
              <View style={styles.grid} testID="home-today-grid">
                <Metric icon="moon" label="Sleep" value={data?.today?.sleep ?? "—"} />
                <Metric icon="briefcase" label="Workload" value={data?.today?.workload ?? "—"} />
                <Metric icon="happy" label="Mood" value={data?.today?.mood ?? "—"} />
              </View>
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(320).duration(400)} style={{ gap: 12 }}>
              <Button title="Take Assessment" icon="clipboard-outline" onPress={() => router.push("/assessment")} testID="home-take-assessment-button" />
              <View style={styles.row}>
                <Pressable onPress={() => router.push("/(personnel)/chat")} style={[styles.quick, { backgroundColor: colors.brandTertiary }]} testID="home-ai-chat-button">
                  <Ionicons name="sparkles" size={22} color={colors.brandPrimary} />
                  <Text style={styles.quickText}>Talk to Mitra AI</Text>
                </Pressable>
                <Pressable
                  onPress={() => latest && router.push({ pathname: "/assessment/result", params: { id: latest.id } })}
                  disabled={!latest}
                  style={[styles.quick, { backgroundColor: riskSoft(level ?? "low", colors), opacity: latest ? 1 : 0.5 }]}
                  testID="home-wellness-activities-button"
                >
                  <Ionicons name="leaf" size={22} color={accent} />
                  <Text style={styles.quickText}>Wellness Activities</Text>
                </Pressable>
              </View>
              <Button
                title={data?.support_requested ? "Counsellor assigned · Follow-up pending" : "Talk to Counsellor"}
                icon="medkit-outline"
                variant={level === "high" ? "danger" : "ghost"}
                onPress={() => support.mutate()}
                loading={support.isPending}
                disabled={data?.support_requested}
                testID="home-talk-counsellor-button"
              />
            </Animated.View>

            <View style={styles.privacy} testID="home-privacy-note">
              <Ionicons name="lock-closed-outline" size={14} color={colors.muted} />
              <Text style={styles.privacyText}>Welfare officers only see your anonymised ID {user?.anon_id}. Your data is never used for disciplinary action.</Text>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function Metric({ icon, label, value }: { icon: string; label: string; value: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const good = ["Good", "Light", "Moderate", "Fair", "Okay"].includes(value);
  const tone = value === "—" ? colors.muted : good ? colors.success : colors.warning;
  return (
    <View style={styles.metric} testID={`home-metric-${label.toLowerCase()}`}>
      <View style={[styles.metricIcon, { backgroundColor: colors.brandTertiary }]}>
        <Ionicons name={icon as any} size={18} color={colors.brandPrimary} />
      </View>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, { color: tone }]}>{value}</Text>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  root: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingBottom: 12, backgroundColor: colors.surface },
  greet: { fontSize: 13, color: colors.muted },
  name: { fontSize: 22, fontWeight: "600", color: colors.onSurface },
  anonChip: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.brandTertiary, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  anonText: { fontSize: 12, fontWeight: "600", color: colors.brandSecondary },
  content: { paddingHorizontal: 16, gap: 16 },
  loading: { paddingVertical: 80, alignItems: "center" },
  attention: { flexDirection: "row", gap: 12, backgroundColor: colors.errorSoft, padding: 14, borderRadius: 12, alignItems: "flex-start" },
  attentionTitle: { fontSize: 14, fontWeight: "600", color: colors.error },
  attentionBody: { fontSize: 13, color: colors.onSurface, lineHeight: 18, marginTop: 2 },
  heroCard: { borderRadius: 20, padding: 20, gap: 18 },
  heroTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  heroLabel: { fontSize: 11, letterSpacing: 1.2, color: colors.onBrandPrimary, opacity: 0.7 },
  heroTitle: { fontSize: 18, color: colors.onBrandPrimary, fontWeight: "600", marginTop: 4 },
  heroBody: { flexDirection: "row", alignItems: "center", gap: 20 },
  ring: { width: 96, height: 96, borderRadius: 48, borderWidth: 6, alignItems: "center", justifyContent: "center" },
  ringScore: { fontSize: 28, fontWeight: "600" },
  ringSub: { fontSize: 11, color: colors.onBrandPrimary, opacity: 0.7, marginTop: -2 },
  levelPill: { alignSelf: "flex-start", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  levelText: { color: colors.onBrandPrimary, fontSize: 13, fontWeight: "600", letterSpacing: 0.8 },
  heroHint: { fontSize: 13, color: colors.onBrandPrimary, opacity: 0.8 },
  hrRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  hrText: { fontSize: 12, color: colors.onBrandPrimary, opacity: 0.9 },
  grid: { flexDirection: "row", gap: 12 },
  metric: { flex: 1, backgroundColor: colors.surfaceSecondary, borderRadius: 16, padding: 14, gap: 8, borderWidth: 1, borderColor: colors.border },
  metricIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  metricLabel: { fontSize: 12, color: colors.muted },
  metricValue: { fontSize: 15, fontWeight: "600" },
  row: { flexDirection: "row", gap: 12 },
  quick: { flex: 1, borderRadius: 16, padding: 16, gap: 10, minHeight: 88, justifyContent: "space-between" },
  quickText: { fontSize: 14, fontWeight: "600", color: colors.onSurface },
  privacy: { flexDirection: "row", gap: 8, alignItems: "flex-start", paddingHorizontal: 4 },
  privacyText: { flex: 1, fontSize: 12, color: colors.muted, lineHeight: 16 },
}));
