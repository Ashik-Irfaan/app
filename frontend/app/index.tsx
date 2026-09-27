import { Redirect } from "expo-router";
import { ActivityIndicator, Text, View } from "react-native";

import { useAuth } from "@/src/context/auth";
import { makeStyles, useTheme } from "@/src/theme";

export default function Index() {
  const { user, loading } = useAuth();
  const styles = useStyles();
  const { colors } = useTheme();

  if (loading) {
    return (
      <View style={styles.container} testID="splash-loading">
        <Text style={styles.brand}>Mind Well</Text>
        <ActivityIndicator color={colors.onBrandPrimary} />
      </View>
    );
  }
  if (!user) return <Redirect href="/(auth)/login" />;
  if (user.role === "therapist") return <Redirect href="/(therapist)" />;
  return <Redirect href="/(personnel)" />;
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center", gap: 16 },
  brand: { color: colors.onBrandPrimary, fontSize: 28, fontWeight: "600", letterSpacing: 1 },
}));
