import Ionicons from "@react-native-vector-icons/ionicons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import Animated, { FadeInRight, FadeOutLeft } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, Question, RiskResult } from "@/src/api/client";
import { useToast } from "@/src/components/toast";
import { Button, haptic, ScreenHeader } from "@/src/components/ui";
import { makeStyles, useTheme } from "@/src/theme";

export default function AssessmentScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const qc = useQueryClient();
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});

  const { data: questions, isLoading, isError, refetch } = useQuery({
    queryKey: ["questions"],
    queryFn: () => api<Question[]>("/assessment/questions", { auth: false }),
  });

  const submit = useMutation({
    mutationFn: (payload: Record<string, number>) => api<RiskResult>("/assessments", { method: "POST", body: { answers: payload } }),
    onSuccess: (res) => {
      haptic("success");
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      router.replace({ pathname: "/assessment/result", params: { id: res.id, fresh: "1" } });
    },
    onError: (e: any) => toast.show(e.message ?? "Could not submit", "error"),
  });

  if (isLoading || !questions) {
    return (
      <View style={[styles.root, styles.center]} testID="assessment-loading">
        {isError ? (
          <>
            <Text style={styles.qText}>Could not load questions</Text>
            <Button title="Retry" variant="secondary" onPress={() => refetch()} testID="assessment-retry-button" />
          </>
        ) : (
          <ActivityIndicator color={colors.brandPrimary} />
        )}
      </View>
    );
  }

  const q = questions[index];
  const total = questions.length;
  const selected = answers[q.id];
  const isLast = index === total - 1;
  const progress = (index + 1) / total;

  const next = () => {
    if (selected === undefined) return;
    if (isLast) submit.mutate(answers);
    else setIndex((i) => i + 1);
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]} testID="assessment-screen">
      <ScreenHeader
        title="Wellness check-in"
        subtitle={`Question ${index + 1} of ${total} · ${q.category}`}
        onBack={() => (index > 0 ? setIndex((i) => i - 1) : router.back())}
        right={
          <Pressable onPress={() => router.back()} hitSlop={8} testID="assessment-close-button" style={styles.closeBtn}>
            <Ionicons name="close" size={22} color={colors.muted} />
          </Pressable>
        }
      />
      <View style={styles.progressTrack} testID="assessment-progress">
        <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Animated.View key={q.id} entering={FadeInRight.duration(280)} exiting={FadeOutLeft.duration(200)} style={{ gap: 20 }}>
          <View style={styles.catChip}>
            <Ionicons name={q.category === "Work" ? "briefcase-outline" : "heart-outline"} size={14} color={colors.brandSecondary} />
            <Text style={styles.catText}>{q.category === "Work" ? "Work-related" : "Personal wellness"}</Text>
          </View>
          <Text style={styles.qText} testID="assessment-question-text">{q.text}</Text>
          <View style={{ gap: 10 }}>
            {q.options.map((opt, i) => {
              const active = selected === i;
              return (
                <Pressable
                  key={opt}
                  testID={`assessment-option-${i}`}
                  onPress={() => {
                    haptic("select");
                    setAnswers((a) => ({ ...a, [q.id]: i }));
                  }}
                  style={[styles.option, active && styles.optionActive]}
                >
                  <View style={[styles.radio, active && styles.radioActive]}>{active ? <View style={styles.radioDot} /> : null}</View>
                  <Text style={[styles.optionText, active && styles.optionTextActive]}>{opt}</Text>
                </Pressable>
              );
            })}
          </View>
        </Animated.View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <Text style={styles.footerNote}>Your answers are confidential and used only for your welfare.</Text>
        <Button
          title={isLast ? "See my result" : "Next"}
          icon={isLast ? "sparkles" : "arrow-forward"}
          onPress={next}
          disabled={selected === undefined}
          loading={submit.isPending}
          testID="assessment-next-button"
        />
      </View>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  root: { flex: 1, backgroundColor: colors.surface },
  center: { alignItems: "center", justifyContent: "center", gap: 16, padding: 24 },
  closeBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  progressTrack: { height: 4, backgroundColor: colors.surfaceTertiary, marginHorizontal: 16, borderRadius: 2, overflow: "hidden" },
  progressFill: { height: 4, backgroundColor: colors.success, borderRadius: 2 },
  content: { padding: 24, paddingBottom: 24 },
  catChip: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", backgroundColor: colors.brandTertiary, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  catText: { fontSize: 12, fontWeight: "600", color: colors.brandSecondary },
  qText: { fontSize: 22, lineHeight: 30, color: colors.onSurface, fontWeight: "500" },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    minHeight: 60,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSecondary,
  },
  optionActive: { borderColor: colors.brandPrimary, backgroundColor: colors.brandTertiary },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.borderStrong, alignItems: "center", justifyContent: "center" },
  radioActive: { borderColor: colors.brandPrimary },
  radioDot: { width: 11, height: 11, borderRadius: 6, backgroundColor: colors.brandPrimary },
  optionText: { flex: 1, fontSize: 16, color: colors.onSurface },
  optionTextActive: { fontWeight: "600", color: colors.brandPrimary },
  footer: { paddingHorizontal: 24, paddingTop: 12, gap: 10, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.divider },
  footerNote: { fontSize: 12, color: colors.muted, textAlign: "center" },
}));
