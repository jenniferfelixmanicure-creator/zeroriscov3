import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PremiumButton } from "@/components/PremiumButton";
import { PremiumInput } from "@/components/PremiumInput";
import { useColors } from "@/hooks/useColors";

export default function ForgotPasswordScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  const handleSubmit = async () => {
    if (!email) return;
    // Simulated - would integrate with real email service
    setSent(true);
    Alert.alert("E-mail enviado", "Se essa conta existir, você receberá um link de recuperação.");
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient colors={["rgba(0,200,255,0.06)", "transparent"]} style={styles.topGlow} pointerEvents="none" />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 }]} keyboardShouldPersistTaps="handled">
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Feather name="arrow-left" size={22} color={colors.foreground} />
          </Pressable>

          <View style={[styles.iconWrap, { backgroundColor: colors.muted, borderRadius: 40 }]}>
            <Feather name="lock" size={36} color={colors.primary} />
          </View>

          <Text style={[styles.title, { color: colors.foreground }]}>Recuperar senha</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            Informe seu e-mail e enviaremos instruções para redefinir sua senha.
          </Text>

          <PremiumInput
            label="E-mail"
            placeholder="seu@email.com"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            leftIcon="mail"
            containerStyle={{ marginBottom: 24 }}
          />

          <PremiumButton title={sent ? "E-mail enviado" : "Enviar instruções"} onPress={handleSubmit} disabled={sent} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topGlow: { position: "absolute", top: 0, left: 0, right: 0, height: 200 },
  scroll: { paddingHorizontal: 24, flexGrow: 1 },
  backBtn: { padding: 4, marginBottom: 32, alignSelf: "flex-start" },
  iconWrap: { width: 80, height: 80, alignItems: "center", justifyContent: "center", marginBottom: 24 },
  title: { fontSize: 26, fontFamily: "Inter_700Bold", marginBottom: 10 },
  subtitle: { fontSize: 15, fontFamily: "Inter_400Regular", lineHeight: 22, marginBottom: 32 },
});
