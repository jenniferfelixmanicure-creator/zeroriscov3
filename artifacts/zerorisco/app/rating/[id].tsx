import { router, useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { PremiumButton } from "@/components/PremiumButton";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

export default function RatingScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token } = useAuth();
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleStar = (star: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRating(star);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const rideRes = await fetch(`https://${process.env.EXPO_PUBLIC_DOMAIN}/api/rides/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!rideRes.ok) throw new Error("Ride not found");
      const ride = await rideRes.json();

      const res = await fetch(`https://${process.env.EXPO_PUBLIC_DOMAIN}/api/ratings`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          rideId: Number(id),
          toUserId: ride.driverId,
          rating,
          comment: comment.trim() || null,
        }),
      });
      if (res.ok) {
        Alert.alert("Obrigado!", "Sua avaliação foi enviada.", [
          { text: "OK", onPress: () => router.replace("/(passenger)/") },
        ]);
      }
    } catch {
      Alert.alert("Erro", "Falha ao enviar avaliação");
    } finally {
      setSubmitting(false);
    }
  };

  const messages = ["Péssimo", "Ruim", "Regular", "Bom", "Excelente"];

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top + 24 }]}>
      <LinearGradient colors={["rgba(0,200,255,0.08)", "transparent"]} style={styles.bgGlow} pointerEvents="none" />

      <View style={styles.content}>
        <LinearGradient colors={["#00C8FF", "#0044BB"]} style={[styles.avatar, { borderRadius: 44 }]}>
          <Feather name="user" size={48} color="#fff" />
        </LinearGradient>

        <Text style={[styles.title, { color: colors.foreground }]}>Avalie o motorista</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          Como foi sua experiência nessa corrida?
        </Text>

        <View style={styles.stars}>
          {[1, 2, 3, 4, 5].map((star) => (
            <Pressable key={star} onPress={() => handleStar(star)} style={{ padding: 4 }}>
              <Feather
                name="star"
                size={44}
                color={star <= rating ? "#FFB800" : colors.border}
              />
            </Pressable>
          ))}
        </View>

        <Text style={[styles.ratingLabel, { color: colors.primary }]}>
          {messages[rating - 1]}
        </Text>

        <TextInput
          value={comment}
          onChangeText={setComment}
          placeholder="Deixe um comentário (opcional)"
          placeholderTextColor={colors.mutedForeground}
          multiline
          style={[
            styles.commentInput,
            {
              backgroundColor: colors.muted,
              color: colors.foreground,
              borderColor: colors.cardBorder,
              borderRadius: colors.radius,
            },
          ]}
        />

        <PremiumButton
          title="Enviar avaliação"
          onPress={handleSubmit}
          loading={submitting}
          style={{ width: "100%" }}
        />

        <Pressable onPress={() => router.replace("/(passenger)/")} style={{ marginTop: 8 }}>
          <Text style={[styles.skip, { color: colors.mutedForeground }]}>Pular avaliação</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  bgGlow: { position: "absolute", inset: 0 },
  content: { flex: 1, alignItems: "center", paddingHorizontal: 24, gap: 16 },
  avatar: { width: 88, height: 88, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  title: { fontSize: 26, fontFamily: "Inter_700Bold", textAlign: "center" },
  subtitle: { fontSize: 15, fontFamily: "Inter_400Regular", textAlign: "center" },
  stars: { flexDirection: "row", gap: 4, marginVertical: 8 },
  ratingLabel: { fontSize: 18, fontFamily: "Inter_600SemiBold" },
  commentInput: {
    width: "100%",
    minHeight: 80,
    padding: 14,
    borderWidth: 1,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlignVertical: "top",
  },
  skip: { fontSize: 14, fontFamily: "Inter_400Regular" },
});
