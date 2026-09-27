import Ionicons from "@react-native-vector-icons/ionicons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, RiskResult } from "@/src/api/client";
import { useToast } from "@/src/components/toast";
import { Button, Card, riskColor, riskLabel, SectionTitle } from "@/src/components/ui";
import { makeStyles, useTheme } from "@/src/theme";

export default function ResultScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const qc = useQueryClient();
  const { id, fresh } = useLocalSearchParams<{ id: string; fresh?: string }>();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["assessment", id],
    queryFn: () => api<RiskResult>(`/assessments/${id}`),
    enabled: !!id,
  });

  const support = useMutation({
    mutationFn: () => api<{ ok: boolean; already_open: boolean }>("/support/request", { method: "POST" }),
    onSuccess: (r) => {
      toast.show(r.already_open ? "A counsellor is already assigned to you" : "A counsellor will contact you confidentially", "success");
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e: any) => toast.show(e.message, "error"),
  });

  const goHome = () => router.replace("/(personnel)");

  if (isLoading || !data) {
    return (
      <View style={[styles.root, styles.center]} testID="result-loading">
        {isError ? (
          <>
            <Text style={styles.summary}>Error loading results</Text>
            <Button title="Retry" variant="secondary" onPress={() => refetch()} testID="result-retry-button" />
          </>
        ) : (
          <>
            <ActivityIndicator color={colors.brandPrimary} />
            <Text style={styles.summary}>Calculating your risk profile…</Text>
          </>
        )}
      </View>
    );
  }

  const accent = riskColor(data.level, colors);
  const maxContribution = Math.max(...data.top_factors.map((f) => f.contribution), 1);

  return (
    <View style={styles.root} testID="result-screen">
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
        <View style={[styles.hero, { backgroundColor: accent, paddingTop: insets.top + 8 }]}>
          <View style={styles.heroNav}>
            <Pressable onPress={goHome} hitSlop={8} style={styles.navBtn} testID="result-back-button">
              <Ionicons name="close" size={22} color={colors.onBrandPrimary} />
            </Pressable>
            <Text style={styles.heroKicker}>{fresh ? "ASSESSMENT COMPLETE" : "RISK REPORT"}</Text>
          </View>
          <Animated.View entering={FadeInDown.duration(500)} style={styles.heroBody}>
            <View style={styles.ring}>
              <Text style={styles.ringScore} testID="result-score">{Math.round(data.score)}</Text>
              <Text style={styles.ringSub}>/100</Text>
            </View>
            <Text style={styles.heroLevel} testID="result-level">{riskLabel(data.level)} risk</Text>
            <Text style={styles.heroTitle}>{data.title}</Text>
          </Animated.View>
        </View>

        <View style={styles.content}>
          <Animated.View entering={FadeInDown.delay(100).duration(400)}>
            <Card testID="result-summary-card">
              <Text style={styles.summary}>{data.summary}</Text>
              {data.heart_rate_note ? (
                <View style={styles.hrNote}>
                  <Ionicons name="heart" size={14} color={colors.error} />
                  <Text style={styles.hrNoteText}>{data.heart_rate_note}</Text>
                </View>
              ) : null}
              {data.alert_created || (fresh && data.level === "high") ? (
                <View style={styles.alertNote} testID="result-alert-note">
                  <Ionicons name="notifications" size={14} color={colors.error} />
                  <Text style={styles.alertNoteText}>A welfare officer has been confidentially notified using your anonymised ID.</Text>
                </View>
              ) : null}
            </Card>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(180).duration(400)}>
            <SectionTitle title="Top contributing factors" />
            <Card style={{ gap: 14 }} testID="result-factors-card">
              {data.top_factors.length === 0 ? (
                <Text style={styles.muted}>No strong stress indicators detected. Great going!</Text>
              ) : (
                data.top_factors.map((f) => (
                  <View key={f.id} style={{ gap: 6 }} testID={`result-factor-${f.id}`}>
                    <View style={styles.factorRow}>
                      <Text style={styles.factorLabel}>{f.label}</Text>
                      <Text style={[styles.factorPct, { color: accent }]}>+{f.contribution.toFixed(1)}</Text>
                    </View>
                    <View style={styles.bar}>
                      <View style={[styles.barFill, { width: `${(f.contribution / maxContribution) * 100}%`, backgroundColor: accent }]} />
                    </View>
                    <Text style={styles.factorAnswer}>{f.category} · you answered “{f.answer}”</Text>
                  </View>
                ))
              )}
              <Text style={styles.modelNote}>
                <Ionicons name="git-branch-outline" size={12} color={colors.muted} /> {data.model}. Explainable: each factor’s weight is shown, not a black box.
              </Text>
            </Card>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(260).duration(400)}>
            <SectionTitle title={data.level === "high" ? "Your support pathway" : "Recommended actions"} />
            <Card style={{ gap: 12 }} testID="result-actions-card">
              {data.actions.map((a, i) => (
                <View key={a} style={styles.actionRow}>
                  <View style={[styles.actionNum, { backgroundColor: accent }]}>
                    <Text style={styles.actionNumText}>{i + 1}</Text>
                  </View>
                  <Text style={styles.actionText}>{a}</Text>
                </View>
              ))}
              <View style={styles.pathway}>
                <Ionicons name="git-merge-outline" size={16} color={colors.brandSecondary} />
                <Text style={styles.pathwayText}>{data.pathway}</Text>
              </View>
            </Card>
          </Animated.View>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        {data.level === "high" ? (
          <>
            <Button title="Contact Counsellor" icon="medkit" variant="danger" onPress={() => support.mutate()} loading={support.isPending} testID="result-contact-counsellor-button" />
            <View style={styles.row}>
              <Button title="Mitra Support" variant="secondary" icon="sparkles" onPress={() => router.replace("/(personnel)/chat")} testID="result-wellness-support-button" style={{ flex: 1 }} />
              <Button title="Check Later" variant="ghost" onPress={goHome} testID="result-check-later-button" style={{ flex: 1 }} />
            </View>
          </>
        ) : data.level === "medium" ? (
          <>
            <Button title="Talk to Mitra AI" icon="sparkles" onPress={() => router.replace("/(personnel)/chat")} testID="result-chat-button" />
            <View style={styles.row}>
              <Button title="Optional counselling" variant="secondary" onPress={() => support.mutate()} loading={support.isPending} testID="result-optional-counselling-button" style={{ flex: 1 }} />
              <Button title="Back to Home" variant="ghost" onPress={goHome} testID="result-home-button" style={{ flex: 1 }} />
            </View>
          </>
        ) : (
          <>
            <Button title="Back to Home" icon="home" onPress={goHome} testID="result-home-button" />
            <Button title="Chat with Mitra for a boost" variant="secondary" icon="sparkles" onPress={() => router.replace("/(personnel)/chat")} testID="result-chat-button" />
          </>
        )}
      </View>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  root: { flex: 1, backgroundColor: colors.surface },
  center: { alignItems: "center", justifyContent: "center", gap: 16, padding: 24 },
  hero: { paddingHorizontal: 20, paddingBottom: 28, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  heroNav: { flexDirection: "row", alignItems: "center", gap: 8 },
  navBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center", marginLeft: -8 },
  heroKicker: { color: colors.onBrandPrimary, fontSize: 11, letterSpacing: 1.4, opacity: 0.85 },
  heroBody: { alignItems: "center", gap: 8, marginTop: 8 },
  ring: { width: 120, height: 120, borderRadius: 60, borderWidth: 6, borderColor: colors.overlay, alignItems: "center", justifyContent: "center", backgroundColor: colors.overlay },
  ringScore: { fontSize: 40, fontWeight: "600", color: colors.onBrandPrimary },
  ringSub: { fontSize: 12, color: colors.onBrandPrimary, opacity: 0.8, marginTop: -4 },
  heroLevel: { fontSize: 14, color: colors.onBrandPrimary, opacity: 0.9, letterSpacing: 0.5, textTransform: "uppercase" },
  heroTitle: { fontSize: 22, fontWeight: "600", color: colors.onBrandPrimary, textAlign: "center" },
  content: { padding: 16, gap: 16 },
  summary: { fontSize: 15, lineHeight: 22, color: colors.onSurface },
  hrNote: { flexDirection: "row", gap: 8, alignItems: "center", marginTop: 12 },
  hrNoteText: { fontSize: 13, color: colors.muted },
  alertNote: { flexDirection: "row", gap: 8, alignItems: "flex-start", marginTop: 12, backgroundColor: colors.errorSoft, padding: 10, borderRadius: 10 },
  alertNoteText: { flex: 1, fontSize: 13, color: colors.onSurface, lineHeight: 18 },
  muted: { fontSize: 14, color: colors.muted },
  factorRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  factorLabel: { fontSize: 15, fontWeight: "500", color: colors.onSurface },
  factorPct: { fontSize: 14, fontWeight: "600" },
  bar: { height: 8, backgroundColor: colors.surfaceTertiary, borderRadius: 4, overflow: "hidden" },
  barFill: { height: 8, borderRadius: 4 },
  factorAnswer: { fontSize: 12, color: colors.muted },
  modelNote: { fontSize: 12, color: colors.muted, lineHeight: 16, marginTop: 4 },
  actionRow: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  actionNum: { width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center", marginTop: 1 },
  actionNumText: { color: colors.onBrandPrimary, fontSize: 12, fontWeight: "600" },
  actionText: { flex: 1, fontSize: 15, lineHeight: 22, color: colors.onSurface },
  pathway: { flexDirection: "row", gap: 8, alignItems: "flex-start", backgroundColor: colors.brandTertiary, padding: 12, borderRadius: 12, marginTop: 4 },
  pathwayText: { flex: 1, fontSize: 13, color: colors.onBrandTertiary, lineHeight: 18 },
  footer: { paddingHorizontal: 16, paddingTop: 12, gap: 10, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.divider },
  row: { flexDirection: "row", gap: 10 },
}));
