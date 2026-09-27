import Ionicons from "@react-native-vector-icons/ionicons";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, Overview, PersonnelSummary, RiskLevel } from "@/src/api/client";
import { Button, Card, EmptyState, riskColor, RiskPill, riskSoft } from "@/src/components/ui";
import { useAuth } from "@/src/context/auth";
import { usesNativeTabs } from "@/src/navigation";
import { makeStyles, useTheme } from "@/src/theme";

type Filter = "all" | RiskLevel;
const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "high", label: "High" },
  { key: "medium", label: "Medium" },
  { key: "low", label: "Low" },
];

export default function TherapistDashboard() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;
  const [filter, setFilter] = useState<Filter>("all");

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ["therapist-overview"],
    queryFn: () => api<Overview>("/therapist/overview"),
  });

  const list = (data?.personnel ?? []).filter((p) => filter === "all" || p.level === filter);

  return (
    <View style={styles.root} testID="therapist-dashboard">
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.greet}>Welfare dashboard</Text>
            <Text style={styles.name} testID="therapist-name">{user?.name}</Text>
          </View>
          <View style={styles.privChip}>
            <Ionicons name="eye-off-outline" size={14} color={colors.success} />
            <Text style={styles.privText}>Anonymised</Text>
          </View>
        </View>

        <View style={styles.stats} testID="therapist-stats">
          <Stat label="High" value={data?.counts.high ?? 0} color={colors.error} soft={colors.errorSoft} />
          <Stat label="Medium" value={data?.counts.medium ?? 0} color={colors.warning} soft={colors.warningSoft} />
          <Stat label="Low" value={data?.counts.low ?? 0} color={colors.success} soft={colors.successSoft} />
          <Pressable onPress={() => router.push("/(therapist)/alerts")} style={[styles.stat, { backgroundColor: colors.brandPrimary }]} testID="therapist-open-alerts-stat">
            <Text style={[styles.statValue, { color: colors.onBrandPrimary }]}>{data?.open_alerts ?? 0}</Text>
            <Text style={[styles.statLabel, { color: colors.onBrandPrimary, opacity: 0.8 }]}>Open alerts</Text>
          </Pressable>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow} style={styles.chipScroller}>
          {FILTERS.map((f) => {
            const active = filter === f.key;
            return (
              <Pressable key={f.key} onPress={() => setFilter(f.key)} style={[styles.chip, active && styles.chipActive]} testID={`therapist-filter-${f.key}`}>
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{f.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {isLoading ? (
        <ActivityIndicator color={colors.brandPrimary} style={{ marginTop: 40 }} testID="therapist-loading" />
      ) : isError ? (
        <Card style={{ margin: 16 }}>
          <EmptyState icon="cloud-offline-outline" title="Failed to sync personnel data" body="Check your connection and retry." />
          <Button title="Retry" variant="secondary" onPress={() => refetch()} testID="therapist-retry-button" />
        </Card>
      ) : (
        <FlatList
          data={list}
          keyExtractor={(p) => p.user_ref}
          contentContainerStyle={[styles.list, { paddingBottom: bottomChrome + 24 }]}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.brandPrimary} />}
          testID="therapist-personnel-list"
          ListEmptyComponent={<EmptyState icon="shield-checkmark-outline" title="No personnel in this band" body="Nobody currently matches this risk level." testID="therapist-list-empty" />}
          renderItem={({ item, index }) => (
            <Animated.View entering={FadeInDown.delay(index * 40).duration(300)}>
              <PersonnelRow p={item} onPress={() => router.push({ pathname: "/therapist/personnel/[id]", params: { id: item.user_ref } })} />
            </Animated.View>
          )}
        />
      )}
    </View>
  );
}

function Stat({ label, value, color, soft }: { label: string; value: number; color: string; soft: string }) {
  const styles = useStyles();
  return (
    <View style={[styles.stat, { backgroundColor: soft }]} testID={`therapist-stat-${label.toLowerCase()}`}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function PersonnelRow({ p, onPress }: { p: PersonnelSummary; onPress: () => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const trendIcon = p.trend === "rising" ? "trending-up" : p.trend === "improving" ? "trending-down" : "remove";
  const trendColor = p.trend === "rising" ? colors.error : p.trend === "improving" ? colors.success : colors.muted;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && { opacity: 0.85 }]} testID={`therapist-personnel-${p.anon_id}`}>
      <View style={[styles.scoreBox, { backgroundColor: riskSoft(p.level, colors) }]}>
        <Text style={[styles.scoreText, { color: riskColor(p.level, colors) }]}>{Math.round(p.score)}</Text>
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text style={styles.anon}>{p.anon_id}</Text>
          {p.has_open_alert ? <Ionicons name="notifications" size={14} color={colors.error} /> : null}
          {p.wearable_connected ? <Ionicons name="watch" size={14} color={colors.brandSecondary} /> : null}
        </View>
        <Text style={styles.unit}>{p.unit ?? "Unit withheld"} · {new Date(p.last_assessed).toLocaleDateString(undefined, { day: "numeric", month: "short" })}</Text>
        {p.top_factors[0] ? <Text style={styles.factor}>{p.top_factors.map((f) => f.label).join(" · ")}</Text> : null}
      </View>
      <View style={{ alignItems: "flex-end", gap: 6 }}>
        <RiskPill level={p.level} />
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <Ionicons name={trendIcon as any} size={14} color={trendColor} />
          <Text style={[styles.trend, { color: trendColor }]}>{p.trend}</Text>
        </View>
      </View>
    </Pressable>
  );
}

const useStyles = makeStyles((colors) => ({
  root: { flex: 1, backgroundColor: colors.surface },
  header: { backgroundColor: colors.surface, paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: colors.divider },
  headerRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingBottom: 12 },
  greet: { fontSize: 13, color: colors.muted },
  name: { fontSize: 22, fontWeight: "600", color: colors.onSurface },
  privChip: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.successSoft, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  privText: { fontSize: 12, fontWeight: "600", color: colors.success },
  stats: { flexDirection: "row", gap: 8, paddingHorizontal: 16 },
  stat: { flex: 1, borderRadius: 14, padding: 12, gap: 2, minHeight: 64 },
  statValue: { fontSize: 22, fontWeight: "600" },
  statLabel: { fontSize: 11, color: colors.muted },
  chipScroller: { height: 56 },
  chipRow: { gap: 8, paddingHorizontal: 16, alignItems: "center" },
  chip: { height: 36, paddingHorizontal: 16, borderRadius: 999, backgroundColor: colors.surfaceTertiary, justifyContent: "center", flexShrink: 0, borderWidth: 1, borderColor: colors.surfaceTertiary },
  chipActive: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  chipText: { fontSize: 14, color: colors.muted },
  chipTextActive: { color: colors.onBrandPrimary },
  list: { paddingHorizontal: 16, paddingTop: 12, gap: 10 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.surfaceSecondary, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: colors.border },
  scoreBox: { width: 52, height: 52, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  scoreText: { fontSize: 18, fontWeight: "600" },
  anon: { fontSize: 15, fontWeight: "600", color: colors.onSurface },
  unit: { fontSize: 12, color: colors.muted },
  factor: { fontSize: 12, color: colors.onSurfaceSecondary },
  trend: { fontSize: 11, textTransform: "capitalize" },
}));
