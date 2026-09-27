import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { LogBox, Platform } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/src/components/error-boundary";
import { ToastProvider } from "@/src/components/toast";
import { AuthProvider } from "@/src/context/auth";
import { queryClient } from "@/src/query-client";
import { useTheme } from "@/src/theme";

// Disable logbox errors etc so that users can see the app
// and agent works as expected.
LogBox.ignoreAllLogs(true);
LogBox.ignoreLogs(["Unknown event handler property", "shadow*", "props.pointerEvents", "TouchableMixin"]);

// react-native-gifted-charts emits native-only responder props on web; keep them out of the dev overlay.
if (Platform.OS === "web") {
  const originalError = console.error;
  console.error = (...args: unknown[]) => {
    const first = args[0];
    if (typeof first === "string" && /Unknown event handler property|shadow\*|props\.pointerEvents|TouchableMixin/.test(first)) return;
    originalError(...args);
  };
}

function Root() {
  const { colors } = useTheme();
  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.surface } }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(personnel)" />
        <Stack.Screen name="(therapist)" />
        <Stack.Screen name="assessment/index" options={{ presentation: "card" }} />
        <Stack.Screen name="assessment/result" />
        <Stack.Screen name="therapist/personnel/[id]" />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  // One app level ErrorBoundary; a render crash shows a reload screen
  // instead of a blank app.
  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <QueryClientProvider client={queryClient}>
            <KeyboardProvider>
              <AuthProvider>
                <ToastProvider>
                  <Root />
                </ToastProvider>
              </AuthProvider>
            </KeyboardProvider>
          </QueryClientProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
