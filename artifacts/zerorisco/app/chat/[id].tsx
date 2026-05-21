import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardStickyView } from "react-native-keyboard-controller";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { socket } from "@/lib/socket";

interface Message {
  id: number;
  senderId: number;
  senderName: string;
  content: string;
  createdAt: string;
}

interface SocketMessage {
  rideId?: number;
  senderId: number;
  senderName?: string;
  content?: string;
  text?: string;
  createdAt?: string;
}

export default function ChatScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, token } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const flatRef = useRef<FlatList>(null);
  const msgIdCounter = useRef(Date.now());

  useEffect(() => {
    fetchMessages();

    socket.connect();
    socket.emit("join_ride", id);

    socket.on("new_message", (msg: SocketMessage) => {
      const normalized: Message = {
        id: msgIdCounter.current++,
        senderId: msg.senderId,
        senderName: msg.senderName ?? "Usuário",
        content: msg.content ?? msg.text ?? "",
        createdAt: msg.createdAt ?? new Date().toISOString(),
      };
      setMessages(prev => [normalized, ...prev]);
    });

    return () => {
      socket.off("new_message");
      socket.disconnect();
    };
  }, [id]);

  const fetchMessages = async () => {
    try {
      const res = await fetch(`https://${process.env.EXPO_PUBLIC_DOMAIN}/api/messages/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setMessages([...data].reverse());
      }
    } catch {
      // ignore
    }
  };

  const sendMessage = async () => {
    if (!text.trim() || sending) return;
    const content = text.trim();
    setText("");

    socket.emit("send_message", {
      rideId: Number(id),
      senderId: user?.id,
      text: content,
    });

    try {
      await fetch(`https://${process.env.EXPO_PUBLIC_DOMAIN}/api/messages/${id}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
    } catch {
      // ignore
    }
  };

  const formatTime = (d: string) =>
    new Date(d).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  const isMine = (msg: Message) => msg.senderId === user?.id;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 16, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.title, { color: colors.foreground }]}>Chat da corrida</Text>
        <Feather name="shield" size={20} color={colors.primary} />
      </View>

      <FlatList
        ref={flatRef}
        data={messages}
        keyExtractor={(item, index) => `${item.id}-${index}`}
        inverted
        contentContainerStyle={styles.messageList}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyChat}>
            <Feather name="message-circle" size={40} color={colors.border} />
            <Text style={[styles.emptyChatText, { color: colors.mutedForeground }]}>
              Sem mensagens ainda
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const mine = isMine(item);
          return (
            <View style={[styles.msgWrapper, mine ? styles.msgRight : styles.msgLeft]}>
              <View
                style={[
                  styles.bubble,
                  {
                    backgroundColor: mine
                      ? colors.primary
                      : item.senderId === 0 ? colors.primary + '11' : colors.card,
                    borderWidth: 1,
                    borderColor: mine ? "transparent" : item.senderId === 0 ? colors.primary + '33' : colors.cardBorder,
                  },
                ]}
              >
                {!mine && (
                  <Text style={[styles.senderName, { color: colors.primary }]}>{item.senderName}</Text>
                )}
                <Text style={[styles.msgText, { color: mine ? colors.primaryForeground : colors.foreground }]}>
                  {item.content}
                </Text>
                <Text style={[styles.msgTime, { color: mine ? "rgba(6,13,26,0.6)" : colors.mutedForeground }]}>
                  {formatTime(item.createdAt)}
                </Text>
              </View>
            </View>
          );
        }}
      />

      <KeyboardStickyView offset={{ closed: 0, opened: 0 }}>
        <View
          style={[
            styles.inputBar,
            {
              backgroundColor: colors.card,
              borderTopColor: colors.border,
              paddingBottom: insets.bottom + 8,
            },
          ]}
        >
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Digite uma mensagem..."
            placeholderTextColor={colors.mutedForeground}
            style={[
              styles.textInput,
              { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.cardBorder },
            ]}
            multiline
            returnKeyType="send"
            onSubmitEditing={sendMessage}
          />
          <TouchableOpacity
            onPress={sendMessage}
            disabled={!text.trim() || sending}
            style={[
              styles.sendBtn,
              { backgroundColor: text.trim() ? colors.primary : colors.muted },
            ]}
          >
            <Feather name="send" size={18} color={text.trim() ? colors.primaryForeground : colors.mutedForeground} />
          </TouchableOpacity>
        </View>
      </KeyboardStickyView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    gap: 12,
  },
  backBtn: { padding: 4 },
  title: { flex: 1, fontSize: 18, fontFamily: "Inter_600SemiBold" },
  messageList: { paddingHorizontal: 16, paddingVertical: 16, flexDirection: "column-reverse" },
  msgWrapper: { marginBottom: 10, flexDirection: "row" },
  msgLeft: { justifyContent: "flex-start" },
  msgRight: { justifyContent: "flex-end" },
  bubble: { maxWidth: "75%", borderRadius: 16, padding: 12 },
  senderName: { fontSize: 11, fontFamily: "Inter_600SemiBold", marginBottom: 4 },
  msgText: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 20 },
  msgTime: { fontSize: 10, fontFamily: "Inter_400Regular", marginTop: 4, alignSelf: "flex-end" },
  emptyChat: { alignItems: "center", gap: 12, paddingVertical: 60 },
  emptyChatText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 10,
    borderTopWidth: 1,
  },
  textInput: {
    flex: 1,
    borderRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    maxHeight: 100,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
});
