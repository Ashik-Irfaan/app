import Ionicons from "@react-native-vector-icons/ionicons";
import * as Haptics from "expo-haptics";
import React from "react";
import { ActivityIndicator, Platform, Pressable, StyleProp, Text, View, ViewStyle } from "react-native";

import { RiskLevel } from "@/src/api/client";
import { makeStyles, ThemeColors, useTheme } from "@/src/theme";

export function riskColor(level: RiskLevel | string | null | undefined, colors: ThemeColors) {
  if (level === "high") return colors.error;
  if (level === "medium") return colors.warning;
  return colors.success;
}
export function riskSoft(level: RiskLevel | string | null | undefined, colors: ThemeColors) {
  if (level === "high") return colors.errorSoft;
  if (level === "medium") return colors.warningSoft;
  return colors.successSoft;
}
export function riskLabel(level: RiskLevel | string | null | undefined) {
  if (level === "high") return "High";
  if (level === "medium") return "Medium";
  if (level === "low") return "Low";
  return "—";
}

export function haptic(kind: "light" | "select" | "success" | "error" = "light") {
  if (Platform.OS === "web") return;
  if (kind === "light") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  else if (kind === "select") Haptics.selectionAsync();
  else if (kind === "success") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  else Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
}

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  loading?: boolean;
  disabled?: boolean;
  icon?: string;
  testID: string;
  style?: StyleProp<ViewStyle>;
}

export function Button({ title, onPress, variant = "primary", loading, disabled, icon, testID, style }: ButtonProps) {
  const styles = useStyles();
  const { colors } = useTheme();
  const bg =
    variant === "primary" ? colors.brandPrimary : variant === "secondary" ? colors.brandTertiary : variant === "danger" ? colors.error : "transparent";
  const fg = variant === "primary" || variant === "danger" ? colors.onBrandPrimary : colors.brandPrimary;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      disabled={disabled || loading}
      onPress={() => {
        haptic("light");
        onPress();
      }}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: bg, opacity: disabled ? 0.5 : pressed ? 0.85 : 1 },
        variant === "ghost" && styles.ghost,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon ? <Ionicons name={icon as any} size={18} color={fg} /> : null}
          <Text style={[styles.btnText, { color: fg }]}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}

export function Card({ children, style, testID }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; testID?: string }) {
  const styles = useStyles();
  return (
    <View style={[styles.card, style]} testID={testID}>
      {children}
    </View>
  );
}

export function RiskPill({ level, testID }: { level: RiskLevel | string; testID?: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={[styles.pill, { backgroundColor: riskSoft(level, colors) }]} testID={testID}>
      <View style={[styles.dot, { backgroundColor: riskColor(level, colors) }]} />
      <Text style={[styles.pillText, { color: riskColor(level, colors) }]}>{riskLabel(level)}</Text>
    </View>
  );
}

export function SectionTitle({ title, action, onAction, testID }: { title: string; action?: string; onAction?: () => void; testID?: string }) {
  const styles = useStyles();
  return (
    <View style={styles.sectionRow}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action ? (
        <Pressable onPress={onAction} testID={testID} hitSlop={8}>
          <Text style={styles.sectionAction}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function EmptyState({ icon, title, body, testID }: { icon: string; title: string; body: string; testID?: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.empty} testID={testID}>
      <View style={styles.emptyIcon}>
        <Ionicons name={icon as any} size={28} color={colors.brandSecondary} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyBody}>{body}</Text>
    </View>
  );
}

export function ScreenHeader({ title, subtitle, onBack, right, testID }: { title: string; subtitle?: string; onBack?: () => void; right?: React.ReactNode; testID?: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.header} testID={testID}>
      {onBack ? (
        <Pressable onPress={onBack} style={styles.backBtn} hitSlop={8} testID="header-back-button">
          <Ionicons name="chevron-back" size={22} color={colors.onSurface} />
        </Pressable>
      ) : null}
      <View style={{ flex: 1 }}>
        <Text style={styles.headerTitle}>{title}</Text>
        {subtitle ? <Text style={styles.headerSub}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  btn: {
    minHeight: 52,
    borderRadius: 12,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  ghost: { borderWidth: 1, borderColor: colors.borderStrong },
  btnText: { fontSize: 16, fontWeight: "600" },
  card: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    alignSelf: "flex-start",
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  pillText: { fontSize: 12, fontWeight: "600" },
  sectionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: "600", color: colors.onSurface },
  sectionAction: { fontSize: 14, color: colors.brandSecondary, fontWeight: "500" },
  empty: { alignItems: "center", paddingVertical: 32, paddingHorizontal: 24, gap: 8 },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  emptyTitle: { fontSize: 16, fontWeight: "600", color: colors.onSurface, textAlign: "center" },
  emptyBody: { fontSize: 14, color: colors.muted, textAlign: "center", lineHeight: 20 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 12,
    paddingTop: 8,
    backgroundColor: colors.surface,
  },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center", marginLeft: -8 },
  headerTitle: { fontSize: 20, fontWeight: "600", color: colors.onSurface },
  headerSub: { fontSize: 13, color: colors.muted, marginTop: 2 },
}));
