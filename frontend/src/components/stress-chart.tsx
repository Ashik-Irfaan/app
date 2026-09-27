import React from "react";
import { Text, useWindowDimensions, View } from "react-native";
import { LineChart } from "react-native-gifted-charts";

import { AssessmentSummary } from "@/src/api/client";
import { makeStyles, useTheme } from "@/src/theme";

export function StressChart({ history, testID }: { history: AssessmentSummary[]; testID?: string }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const { width } = useWindowDimensions();
  const chartWidth = Math.min(width, 520) - 32 - 32 - 36;

  const data = history.slice(-10).map((h) => {
    const d = new Date(h.created_at);
    return {
      value: h.score,
      label: `${d.getDate()}/${d.getMonth() + 1}`,
      dataPointColor: h.level === "high" ? colors.error : h.level === "medium" ? colors.warning : colors.success,
    };
  });

  return (
    <View testID={testID} style={styles.wrap}>
      <LineChart
        data={data}
        width={chartWidth}
        height={160}
        curved
        thickness={3}
        color={colors.brandSecondary}
        areaChart
        startFillColor={colors.brandSecondary}
        endFillColor={colors.surfaceSecondary}
        startOpacity={0.25}
        endOpacity={0.02}
        maxValue={100}
        noOfSections={4}
        yAxisThickness={0}
        xAxisThickness={0}
        yAxisTextStyle={{ color: colors.muted, fontSize: 10 }}
        xAxisLabelTextStyle={{ color: colors.muted, fontSize: 10 }}
        rulesColor={colors.divider}
        dataPointsRadius={5}
        initialSpacing={12}
        spacing={data.length > 1 ? Math.max(28, (chartWidth - 24) / (data.length - 1)) : 40}
        hideRules={false}
        isAnimated
        animationDuration={800}
      />
      <View style={styles.legend}>
        <LegendDot color={colors.success} label="Low < 35" />
        <LegendDot color={colors.warning} label="Medium 35–60" />
        <LegendDot color={colors.error} label="High > 60" />
      </View>
    </View>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  const styles = useStyles();
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  wrap: { overflow: "hidden" },
  legend: { flexDirection: "row", gap: 12, marginTop: 8, flexWrap: "wrap" },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11, color: colors.muted },
}));
