import Ionicons from "@react-native-vector-icons/ionicons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Platform, Pressable, Text, TextInput, View } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import Animated, { FadeInUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, ChatMessage } from "@/src/api/client";
import { useToast } from "@/src/components/toast";
import { haptic, ScreenHeader } from "@/src/components/ui";
import { usesNativeTabs } from "@/src/navigation";
import { makeStyles, useTheme } from "@/src/theme";

const SUGGESTIONS = ["I had a long shift today", "Help me relax before sleep", "I miss my family", "Motivate me for tomorrow"];

export default function ChatScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const qc = useQueryClient();
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;
  const [text, setText] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const listRef = useRef<FlatList<ChatMessage>>(null);

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ["chat"],
    queryFn: () => api<ChatMessage[]>("/chat/history"),
  });

  const send = useMutation({
    mutationFn: (message: string) => api<ChatMessage>("/chat/message", { method: "POST", body: { message } }),
    onMutate: (message) => {
      setPending(message);
      setText("");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["chat"] }),
    onError: (e: any) => toast.show(e.message ?? "Mitra is unavailable right now", "error"),
    onSettled: () => setPending(null),
  });

  const clear = useMutation({
    mutationFn: () => api("/chat/history", { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["chat"] }),
  });

  const items: ChatMessage[] = pending
    ? [...messages, { id: "pending-user", role: "user", content: pending, created_at: "" }, { id: "pending-ai", role: "assistant", content: "…", created_at: "" }]
    : messages;

  useEffect(() => {
    if (items.length) setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
  }, [items.length]);

  const submit = () => {
    const t = text.trim();
    if (!t || send.isPending) return;
    haptic("light");
    send.mutate(t);
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]} testID="chat-screen">
      <ScreenHeader
        title="Mitra"
        subtitle="Your friendly AI wellness companion"
        right={
          messages.length ? (
            <Pressable onPress={() => clear.mutate()} hitSlop={8} testID="chat-clear-button" style={styles.clearBtn}>
              <Ionicons name="trash-outline" size={20} color={colors.muted} />
            </Pressable>
          ) : null
        }
      />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }} keyboardVerticalOffset={0}>
        <FlatList
          ref={listRef}
          data={items}
          keyExtractor={(m) => m.id}
          contentContainerStyle={styles.list}
          testID="chat-message-list"
          ListEmptyComponent={
            isLoading ? (
              <ActivityIndicator color={colors.brandPrimary} style={{ marginTop: 40 }} />
            ) : (
              <View style={styles.empty} testID="chat-empty-state">
                <View style={styles.avatarBig}>
                  <Ionicons name="sparkles" size={30} color={colors.onBrandPrimary} />
                </View>
                <Text style={styles.emptyTitle}>How are you feeling today?</Text>
                <Text style={styles.emptyBody}>Mitra is here for a friendly, motivating chat — no judgement, fully confidential.</Text>
                <View style={styles.chips}>
                  {SUGGESTIONS.map((s) => (
                    <Pressable key={s} onPress={() => send.mutate(s)} style={styles.chip} testID={`chat-suggestion-${SUGGESTIONS.indexOf(s)}`}>
                      <Text style={styles.chipText}>{s}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )
          }
          renderItem={({ item }) => <Bubble msg={item} />}
        />
        <View style={[styles.inputBar, { paddingBottom: bottomChrome + 12 }]}>
          <TextInput
            testID="chat-input"
            value={text}
            onChangeText={setText}
            placeholder="Message Mitra…"
            placeholderTextColor={colors.muted}
            style={styles.input}
            multiline
            maxLength={2000}
            onSubmitEditing={submit}
            blurOnSubmit
          />
          <Pressable onPress={submit} disabled={!text.trim() || send.isPending} style={[styles.sendBtn, { opacity: !text.trim() || send.isPending ? 0.5 : 1 }]} testID="chat-send-button">
            {send.isPending ? <ActivityIndicator color={colors.onBrandPrimary} size="small" /> : <Ionicons name="arrow-up" size={20} color={colors.onBrandPrimary} />}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

function Bubble({ msg }: { msg: ChatMessage }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const mine = msg.role === "user";
  return (
    <Animated.View entering={FadeInUp.duration(250)} style={[styles.bubbleRow, mine && { justifyContent: "flex-end" }]}>
      {!mine ? (
        <View style={styles.avatar}>
          <Ionicons name="sparkles" size={14} color={colors.onBrandPrimary} />
        </View>
      ) : null}
      <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleAi]} testID={`chat-bubble-${msg.role}`}>
        <Text style={[styles.bubbleText, mine && { color: colors.onBrandPrimary }]}>{msg.content}</Text>
      </View>
    </Animated.View>
  );
}

const useStyles = makeStyles((colors) => ({
  root: { flex: 1, backgroundColor: colors.surface },
  clearBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  list: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16, gap: 10, flexGrow: 1 },
  empty: { alignItems: "center", paddingTop: 40, paddingHorizontal: 16, gap: 10 },
  avatarBig: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.brandSecondary, alignItems: "center", justifyContent: "center", marginBottom: 6 },
  emptyTitle: { fontSize: 20, fontWeight: "600", color: colors.onSurface, textAlign: "center" },
  emptyBody: { fontSize: 14, color: colors.muted, textAlign: "center", lineHeight: 20 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center", marginTop: 12 },
  chip: { paddingHorizontal: 14, height: 36, borderRadius: 999, backgroundColor: colors.brandTertiary, justifyContent: "center" },
  chipText: { fontSize: 13, color: colors.onBrandTertiary, fontWeight: "500" },
  bubbleRow: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  avatar: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.brandSecondary, alignItems: "center", justifyContent: "center" },
  bubble: { maxWidth: "78%", paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18 },
  bubbleAi: { backgroundColor: colors.brandTertiary, borderBottomLeftRadius: 6 },
  bubbleMine: { backgroundColor: colors.brandPrimary, borderBottomRightRadius: 6 },
  bubbleText: { fontSize: 15, lineHeight: 21, color: colors.onSurface },
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    backgroundColor: colors.surface,
  },
  input: {
    flex: 1,
    minHeight: 46,
    maxHeight: 120,
    borderRadius: 22,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.onSurface,
  },
  sendBtn: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
}));
