import Ionicons from "@react-native-vector-icons/ionicons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import React, { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, useWindowDimensions, View } from "react-native";
import { LineChart } from "react-native-gifted-charts";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, WearableState } from "@/src/api/client";
import { useToast } from "@/src/components/toast";
import { Button, Card, haptic, ScreenHeader, SectionTitle } from "@/src/components/ui";
import { usesNativeTabs } from "@/src/navigation";
import { makeStyles, useTheme } from "@/src/theme";

const HERO = "https://images.unsplash.com/photo-1631863552008-f6491c3c9062?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200";
const DEVICES = [
  { name: "Apple Watch Series 10", icon: "watch" },
  { name: "Samsung Galaxy Watch 7", icon: "watch-outline" },
  { name: "Fitbit Charge 6", icon: "fitness" },
  { name: "Noise ColorFit Band", icon: "pulse" },
];

export default function WearableScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const qc = useQueryClient();
  const { width } = useWindowDimensions();
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;
  const [scanning, setScanning] = useState<string | null>(null);

  const { data, isLoading } = useQuery({ queryKey: ["wearable"], queryFn: () => api<WearableState>("/wearable") });

  const connect = useMutation({
    mutationFn: (device: string) => api<WearableState>("/wearable/connect", { method: "POST", body: { device } }),
    onSuccess: (_, device) => {
      haptic("success");
      toast.show(`${device} connected`, "success");
      qc.invalidateQueries({ queryKey: ["wearable"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e: any) => toast.show(e.message, "error"),
    onSettled: () => setScanning(null),
  });
  const disconnect = useMutation({
    mutationFn: () => api<WearableState>("/wearable/disconnect", { method: "POST" }),
    onSuccess: () => {
      toast.show("Wearable disconnected");
      qc.invalidateQueries({ queryKey: ["wearable"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  const pair = (device: string) => {
    setScanning(device);
    setTimeout(() => connect.mutate(device), 1500);
  };

  const reading = data?.reading;
  const statusColor = reading?.status === "elevated" ? colors.error : reading?.status === "moderate" ? colors.warning : colors.success;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]} testID="wearable-screen">
      <ScreenHeader title="Wearable" subtitle="Voluntary wellness signals from your device" />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomChrome + 24 }]} showsVerticalScrollIndicator={false}>
        {isLoading ? (
          <ActivityIndicator color={colors.brandPrimary} style={{ marginTop: 40 }} />
        ) : data?.connected && reading ? (
          <>
            <Animated.View entering={FadeInDown.duration(400)}>
              <View style={styles.deviceCard} testID="wearable-connected-card">
                <View style={styles.deviceRow}>
                  <View style={styles.deviceIcon}>
                    <Ionicons name="watch" size={22} color={colors.onBrandPrimary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.deviceName} testID="wearable-device-name">{data.device}</Text>
                    <View style={styles.liveRow}>
                      <View style={styles.liveDot} />
                      <Text style={styles.liveText}>Connected · syncing</Text>
                    </View>
                  </View>
                </View>
              </View>
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(100).duration(400)}>
              <Card testID="wearable-heart-card">
                <View style={styles.hrHeader}>
                  <View style={[styles.hrIcon, { backgroundColor: colors.errorSoft }]}>
                    <Ionicons name="heart" size={22} color={colors.error} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.hrLabel}>Resting heart rate</Text>
                    <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 6 }}>
                      <Text style={styles.hrValue} testID="wearable-heart-rate">{reading.heart_rate}</Text>
                      <Text style={styles.hrUnit}>bpm</Text>
                    </View>
                  </View>
                  <View style={[styles.statusPill, { backgroundColor: statusColor }]}>
                    <Text style={styles.statusText} testID="wearable-heart-status">{reading.status.toUpperCase()}</Text>
                  </View>
                </View>
                <View style={{ overflow: "hidden", marginTop: 12 }}>
                  <LineChart
                    data={reading.trend.map((v) => ({ value: v }))}
                    width={Math.min(width, 520) - 32 - 32 - 20}
                    height={90}
                    curved
                    thickness={2.5}
                    color={colors.error}
                    hideDataPoints
                    hideRules
                    hideYAxisText
                    yAxisThickness={0}
                    xAxisThickness={0}
                    areaChart
                    startFillColor={colors.error}
                    endFillColor={colors.surfaceSecondary}
                    startOpacity={0.2}
                    endOpacity={0}
                    spacing={(Math.min(width, 520) - 84) / 11}
                    initialSpacing={0}
                    maxValue={120}
                    isAnimated
                  />
                </View>
                <Text style={styles.chartCaption}>Last 12 hours · Elevated resting HR adds weight to your stress-risk model</Text>
              </Card>
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(200).duration(400)}>
              <View style={styles.grid} testID="wearable-metrics-grid">
                <Metric icon="analytics" label="HRV" value={`${reading.hrv_ms} ms`} />
                <Metric icon="moon" label="Sleep" value={`${reading.sleep_hours} h`} />
                <Metric icon="footsteps" label="Steps" value={reading.steps.toLocaleString()} />
              </View>
            </Animated.View>

            <Button title="Disconnect device" variant="ghost" icon="close-circle-outline" onPress={() => disconnect.mutate()} loading={disconnect.isPending} testID="wearable-disconnect-button" />
          </>
        ) : (
          <>
            <View style={styles.heroWrap}>
              <Image source={{ uri: HERO }} style={styles.hero} contentFit="cover" transition={300} />
            </View>
            <Text style={styles.introTitle}>Pair a smartwatch or wrist band</Text>
            <Text style={styles.introBody}>
              Share heart rate, HRV and sleep signals voluntarily. Combined with your check-ins, this makes stress monitoring continuous instead of questionnaire-only.
            </Text>
            <SectionTitle title="Available devices" />
            <Card style={{ padding: 0 }} testID="wearable-device-list">
              {DEVICES.map((d, i) => (
                <Pressable
                  key={d.name}
                  onPress={() => pair(d.name)}
                  disabled={!!scanning}
                  style={[styles.deviceItem, i < DEVICES.length - 1 && styles.deviceDivider]}
                  testID={`wearable-device-${i}`}
                >
                  <View style={[styles.deviceIcon, { backgroundColor: colors.brandTertiary }]}>
                    <Ionicons name={d.icon as any} size={20} color={colors.brandPrimary} />
                  </View>
                  <Text style={styles.deviceItemName}>{d.name}</Text>
                  {scanning === d.name ? (
                    <View style={styles.scanRow}>
                      <ActivityIndicator size="small" color={colors.brandSecondary} />
                      <Text style={styles.scanText}>Pairing…</Text>
                    </View>
                  ) : (
                    <Ionicons name="bluetooth" size={18} color={colors.brandSecondary} />
                  )}
                </Pressable>
              ))}
            </Card>
            <View style={styles.privacy}>
              <Ionicons name="lock-closed-outline" size={14} color={colors.muted} />
              <Text style={styles.privacyText}>Biometric data is optional, encrypted and can be disconnected anytime. Prototype uses simulated readings.</Text>
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
  return (
    <View style={styles.metric}>
      <Ionicons name={icon as any} size={18} color={colors.brandSecondary} />
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  root: { flex: 1, backgroundColor: colors.surface },
  content: { paddingHorizontal: 16, gap: 16 },
  heroWrap: { borderRadius: 20, overflow: "hidden", height: 180, backgroundColor: colors.surfaceTertiary },
  hero: { width: "100%", height: "100%" },
  introTitle: { fontSize: 20, fontWeight: "600", color: colors.onSurface },
  introBody: { fontSize: 14, color: colors.muted, lineHeight: 20, marginTop: -8 },
  deviceItem: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16, minHeight: 64 },
  deviceDivider: { borderBottomWidth: 1, borderBottomColor: colors.divider },
  deviceIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: colors.brandSecondary },
  deviceItemName: { flex: 1, fontSize: 15, color: colors.onSurface, fontWeight: "500" },
  scanRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  scanText: { fontSize: 12, color: colors.brandSecondary },
  deviceCard: { backgroundColor: colors.brandPrimary, borderRadius: 20, padding: 16 },
  deviceRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  deviceName: { fontSize: 16, fontWeight: "600", color: colors.onBrandPrimary },
  liveRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success },
  liveText: { fontSize: 12, color: colors.onBrandPrimary, opacity: 0.8 },
  hrHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  hrIcon: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  hrLabel: { fontSize: 12, color: colors.muted },
  hrValue: { fontSize: 32, fontWeight: "600", color: colors.onSurface, lineHeight: 36 },
  hrUnit: { fontSize: 13, color: colors.muted, marginBottom: 4 },
  statusPill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  statusText: { fontSize: 11, fontWeight: "600", color: colors.onBrandPrimary, letterSpacing: 0.6 },
  chartCaption: { fontSize: 11, color: colors.muted, marginTop: 6 },
  grid: { flexDirection: "row", gap: 12 },
  metric: { flex: 1, backgroundColor: colors.surfaceSecondary, borderRadius: 16, padding: 14, gap: 6, borderWidth: 1, borderColor: colors.border },
  metricLabel: { fontSize: 12, color: colors.muted },
  metricValue: { fontSize: 16, fontWeight: "600", color: colors.onSurface },
  privacy: { flexDirection: "row", gap: 8, alignItems: "flex-start", paddingHorizontal: 4 },
  privacyText: { flex: 1, fontSize: 12, color: colors.muted, lineHeight: 16 },
}));
