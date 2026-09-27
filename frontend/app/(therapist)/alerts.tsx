import Ionicons from "@react-native-vector-icons/ionicons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { ActivityIndicator, FlatList, Modal, Platform, Pressable, RefreshControl, Text, TextInput, View } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Alert as AlertT, api } from "@/src/api/client";
import { useToast } from "@/src/components/toast";
import { Button, EmptyState, haptic, RiskPill, ScreenHeader } from "@/src/components/ui";
import { usesNativeTabs } from "@/src/navigation";
import { makeStyles, useTheme } from "@/src/theme";

export default function AlertsScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const qc = useQueryClient();
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;
  const [target, setTarget] = useState<AlertT | null>(null);
  const [note, setNote] = useState("");

  const { data = [], isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["therapist-alerts"],
    queryFn: () => api<AlertT[]>("/therapist/alerts"),
  });

  const followup = useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) => api(`/therapist/alerts/${id}/followup`, { method: "POST", body: { note } }),
    onSuccess: () => {
      haptic("success");
      toast.show("Follow-up recorded", "success");
      setTarget(null);
      setNote("");
      qc.invalidateQueries({ queryKey: ["therapist-alerts"] });
      qc.invalidateQueries({ queryKey: ["therapist-overview"] });
    },
    onError: (e: any) => toast.show(e.message, "error"),
  });

  const open = data.filter((a) => a.status === "open");
  const done = data.filter((a) => a.status !== "open");
  const sections = [...open, ...done];

  return (
    <View style={[styles.root, { paddingTop: insets.top }]} testID="therapist-alerts-screen">
      <ScreenHeader title="Alerts" subtitle={`${open.length} open · ${done.length} followed up`} />
      {isLoading ? (
        <ActivityIndicator color={colors.brandPrimary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={sections}
          keyExtractor={(a) => a.id}
          contentContainerStyle={[styles.list, { paddingBottom: bottomChrome + 24 }]}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.brandPrimary} />}
          testID="therapist-alerts-list"
          ListEmptyComponent={<EmptyState icon="shield-checkmark-outline" title="No alerts" body="No high-risk indicators have been detected." testID="alerts-empty" />}
          renderItem={({ item }) => {
            const isOpen = item.status === "open";
            return (
              <View style={[styles.card, isOpen && styles.cardOpen]} testID={`alert-card-${item.id}`}>
                <View style={styles.cardTop}>
                  <View style={[styles.iconBox, { backgroundColor: isOpen ? colors.errorSoft : colors.successSoft }]}>
                    <Ionicons name={isOpen ? "warning" : "checkmark-done"} size={20} color={isOpen ? colors.error : colors.success} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Pressable onPress={() => router.push({ pathname: "/therapist/personnel/[id]", params: { id: item.user_ref } })} testID={`alert-open-personnel-${item.id}`}>
                      <Text style={styles.anon}>{item.anon_id} <Ionicons name="open-outline" size={12} color={colors.brandSecondary} /></Text>
                    </Pressable>
                    <Text style={styles.meta}>
                      {item.source === "self_request" ? "Requested counsellor" : "AI-detected high risk"} · {new Date(item.created_at).toLocaleDateString(undefined, { day: "numeric", month: "short" })}
                    </Text>
                  </View>
                  <View style={{ alignItems: "flex-end", gap: 4 }}>
                    <RiskPill level={item.level} />
                    {item.score != null ? <Text style={styles.score}>{Math.round(item.score)}/100</Text> : null}
                  </View>
                </View>
                {item.top_factors.length ? (
                  <View style={styles.factors}>
                    {item.top_factors.slice(0, 3).map((f) => (
                      <View key={f.id} style={styles.factorChip}>
                        <Text style={styles.factorText}>{f.label}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}
                {isOpen ? (
                  <Button title="Mark follow-up" icon="create-outline" variant="secondary" onPress={() => setTarget(item)} testID={`alert-followup-button-${item.id}`} />
                ) : (
                  <View style={styles.noteBox}>
                    <Ionicons name="document-text-outline" size={14} color={colors.muted} />
                    <Text style={styles.noteText}>{item.followup_note}</Text>
                  </View>
                )}
              </View>
            );
          }}
        />
      )}

      <Modal visible={!!target} transparent animationType="slide" onRequestClose={() => setTarget(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalWrap}>
          <Pressable style={styles.backdrop} onPress={() => setTarget(null)} testID="followup-backdrop" />
          <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]} testID="followup-sheet">
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}>Follow-up for {target?.anon_id}</Text>
            <Text style={styles.sheetBody}>Record the welfare intervention (counselling session, workload adjustment, leave recommendation, referral).</Text>
            <TextInput
              testID="followup-note-input"
              value={note}
              onChangeText={setNote}
              placeholder="e.g. Counselling session completed, recommended 7 days leave, review in 2 weeks"
              placeholderTextColor={colors.muted}
              multiline
              style={styles.noteInput}
              autoFocus
            />
            <Button title="Save follow-up" onPress={() => target && followup.mutate({ id: target.id, note: note.trim() })} disabled={!note.trim()} loading={followup.isPending} testID="followup-save-button" />
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  root: { flex: 1, backgroundColor: colors.surface },
  list: { paddingHorizontal: 16, paddingTop: 4, gap: 12 },
  card: { backgroundColor: colors.surfaceSecondary, borderRadius: 16, padding: 14, gap: 12, borderWidth: 1, borderColor: colors.border },
  cardOpen: { borderColor: colors.error },
  cardTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  iconBox: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  anon: { fontSize: 15, fontWeight: "600", color: colors.onSurface },
  meta: { fontSize: 12, color: colors.muted, marginTop: 2 },
  score: { fontSize: 11, color: colors.muted },
  factors: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  factorChip: { backgroundColor: colors.brandTertiary, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  factorText: { fontSize: 12, color: colors.onBrandTertiary },
  noteBox: { flexDirection: "row", gap: 8, alignItems: "flex-start", backgroundColor: colors.surfaceTertiary, padding: 10, borderRadius: 10 },
  noteText: { flex: 1, fontSize: 13, color: colors.onSurface, lineHeight: 18 },
  modalWrap: { flex: 1, justifyContent: "flex-end" },
  backdrop: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.scrim },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, gap: 12 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.borderStrong, alignSelf: "center", marginBottom: 4 },
  sheetTitle: { fontSize: 18, fontWeight: "600", color: colors.onSurface },
  sheetBody: { fontSize: 13, color: colors.muted, lineHeight: 18 },
  noteInput: { minHeight: 100, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSecondary, padding: 14, fontSize: 15, color: colors.onSurface, textAlignVertical: "top" },
}));
