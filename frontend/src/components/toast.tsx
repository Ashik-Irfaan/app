import Ionicons from "@react-native-vector-icons/ionicons";
import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { Text, View } from "react-native";
import Animated, { FadeInUp, FadeOutUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { makeStyles, useTheme } from "@/src/theme";

type Kind = "success" | "error" | "info";
interface ToastCtx {
  show: (message: string, kind?: Kind) => void;
}
const Ctx = createContext<ToastCtx | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<{ message: string; kind: Kind } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const { colors } = useTheme();

  const show = useCallback((message: string, kind: Kind = "info") => {
    setToast({ message, kind });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), 3000);
  }, []);

  const value = useMemo(() => ({ show }), [show]);
  const bg = toast?.kind === "success" ? colors.success : toast?.kind === "error" ? colors.error : colors.surfaceInverse;
  const icon = toast?.kind === "success" ? "checkmark-circle" : toast?.kind === "error" ? "alert-circle" : "information-circle";

  return (
    <Ctx.Provider value={value}>
      {children}
      {toast && (
        <Animated.View
          entering={FadeInUp}
          exiting={FadeOutUp}
          pointerEvents="none"
          style={[styles.wrap, { top: insets.top + 8 }]}
        >
          <View style={[styles.toast, { backgroundColor: bg }]} testID="toast-message">
            <Ionicons name={icon} size={18} color={colors.onSurfaceInverse} />
            <Text style={styles.text}>{toast.message}</Text>
          </View>
        </Animated.View>
      )}
    </Ctx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

const useStyles = makeStyles((colors) => ({
  wrap: { position: "absolute", left: 16, right: 16, alignItems: "center" },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    maxWidth: 480,
    shadowColor: colors.onSurface,
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  text: { color: colors.onSurfaceInverse, fontSize: 14, flexShrink: 1 },
}));
