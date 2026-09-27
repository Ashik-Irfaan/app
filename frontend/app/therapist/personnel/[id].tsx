import Ionicons from "@react-native-vector-icons/ionicons";
import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, PersonnelDetail } from "@/src/api/client";
import { StressChart } from "@/src/components/stress-chart";
import { Button, Card, EmptyState, riskColor, RiskPill, ScreenHeader, SectionTitle } from "@/src/components/ui";
import { makeStyles, useTheme } from "@/src/theme";

export default function PersonnelDetailScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["therapist-personnel", id],
    queryFn: () => api<PersonnelDetail>(`/therapist/personnel/${id}`),
    enabled: !!id,
  });

  const latest = data?.history[data.history.length - 1];

  return (
    <View style={[styles.root, { paddingTop: insets.top }]} testID="personnel-detail-screen">
      <ScreenHeader title={data?.anon_id ?? "Personnel"} subtitle={data?.unit ?? "Anonymised welfare record"} onBack={() => router.back()} />
      {isLoading ? (
        <ActivityIndicator color={colors.brandPrimary} style={{ marginTop: 40 }} />
      ) : isError || !data ? (
        <Card style={{ margin: 16 }}>
          <EmptyState icon="cloud-offline-outline" title="Could not load record" body="Try again." />
          <Button title="Retry" variant="secondary" onPress={() => refetch()} testID="detail-retry-button" />
        </Card>
      ) : (
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]} showsVerticalScrollIndicator={false}>
          <Card testID="detail-summary-card">
            <View style={styles.topRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Latest risk score</Text>
                <Text style={[styles.score, { color: riskColor(latest?.level, colors) }]} testID="detail-score">{latest ? Math.round(latest.score) : "--"}</Text>
              </View>
              {latest ? <RiskPill level={latest.level} testID="detail-level" /> : null}
            </View>
            <View style={styles.metaRow}>
              <Meta icon="calendar-outline" text={`${data.history.length} check-ins`} />
              <Meta icon="watch-outline" text={data.wearable_connected ? "Wearable linked" : "No wearable"} />
              <Meta icon="notifications-outline" text={`${data.alerts.length} alerts`} />
            </View>
          </Card>

          <Card testID="detail-trend-card">
            <SectionTitle title="Assessment trend" />
            {data.history.length > 1 ? (
              <StressChart history={data.history} testID="detail-stress-chart" />
            ) : (
              <EmptyState icon="analytics-outline" title="Not enough data" body="Trend appears after two check-ins." />
            )}
          </Card>

          <SectionTitle title="Current contributing factors" />
          <Card style={{ gap: 10 }} testID="detail-factors-card">
            {data.top_factors.length === 0 ? (
              <Text style={styles.muted}>No strong indicators.</Text>
            ) : (
              data.top_factors.map((f) => (
                <View key={f.id} style={styles.factorRow}>
                  <View style={[styles.sevDot, { backgroundColor: f.severity >= 3 ? colors.error : colors.warning }]} />
                  <Text style={styles.factorLabel}>{f.label}</Text>
                  <Text style={styles.factorPct}>+{f.contribution.toFixed(1)}</Text>
                </View>
              ))
            )}
          </Card>

          <SectionTitle title="Recommended interventions" />
          <Card style={{ gap: 10 }} testID="detail-interventions-card">
            {recommendations(latest?.level).map((r) => (
              <View key={r} style={styles.factorRow}>
                <Ionicons name="checkmark-circle-outline" size={18} color={colors.brandSecondary} />
                <Text style={styles.factorLabel}>{r}</Text>
              </View>
            ))}
          </Card>

          <SectionTitle title="Alert history" />
          <Card style={{ gap: 12 }} testID="detail-alerts-card">
            {data.alerts.length === 0 ? (
              <Text style={styles.muted}>No alerts raised.</Text>
            ) : (
              data.alerts.map((a) => (
                <View key={a.id} style={styles.alertRow}>
                  <Ionicons name={a.status === "open" ? "warning" : "checkmark-done"} size={18} color={a.status === "open" ? colors.error : colors.success} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.factorLabel}>
                      {a.status === "open" ? "Open" : "Followed up"} · {new Date(a.created_at).toLocaleDateString(undefined, { day: "numeric", month: "short" })}
                    </Text>
                    {a.followup_note ? <Text style={styles.muted}>{a.followup_note}</Text> : null}
                  </View>
                </View>
              ))
            )}
          </Card>
        </ScrollView>
      )}
    </View>
  );
}

function recommendations(level?: string) {
  if (level === "high") return ["Schedule counselling within 48 hours", "Recommend temporary workload rebalancing", "Consider leave / rest period", "Weekly follow-up monitoring"];
  if (level === "medium") return ["Optional counselling check-in", "Sleep hygiene & stress-management guidance", "Bi-weekly wellness re-assessment"];
  return ["Continue periodic monitoring", "Reinforce healthy routines", "No intervention required"];
}

function Meta({ icon, text }: { icon: string; text: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.meta}>
      <Ionicons name={icon as any} size={14} color={colors.muted} />
      <Text style={styles.metaText}>{text}</Text>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  root: { flex: 1, backgroundColor: colors.surface },
  content: { paddingHorizontal: 16, gap: 16 },
  topRow: { flexDirection: "row", alignItems: "center" },
  label: { fontSize: 12, color: colors.muted },
  score: { fontSize: 36, fontWeight: "600" },
  metaRow: { flexDirection: "row", gap: 14, marginTop: 12, flexWrap: "wrap" },
  meta: { flexDirection: "row", alignItems: "center", gap: 5 },
  metaText: { fontSize: 12, color: colors.muted },
  muted: { fontSize: 13, color: colors.muted },
  factorRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  sevDot: { width: 8, height: 8, borderRadius: 4 },
  factorLabel: { flex: 1, fontSize: 14, color: colors.onSurface },
  factorPct: { fontSize: 13, fontWeight: "600", color: colors.brandSecondary },
  alertRow: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
}));
