import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { PremiumButton } from "@/components/PremiumButton";
import { PremiumInput } from "@/components/PremiumInput";
import { useColors } from "@/hooks/useColors";

function formatCpf(raw: string) {
  const digits = raw.replace(/\D/g, "").slice(0, 11);
  return digits
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/(\d{3})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3-$4");
}

export default function ForgotPasswordScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [cpf, setCpf] = useState("");
  const [phone, setPhone] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    const rawCpf = cpf.replace(/\D/g, "");
    if (!rawCpf || !phone || !newPassword || !confirmPassword) {
      Alert.alert("Atenção", "Preencha todos os campos.");
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert("Senha inválida", "A senha deve ter no mínimo 6 caracteres.");
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert("Senhas não conferem", "As senhas digitadas são diferentes.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`https://${process.env.EXPO_PUBLIC_DOMAIN}/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cpf: rawCpf, phone, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        Alert.alert("Erro", data.error ?? "Não foi possível redefinir a senha.");
        return;
      }
      Alert.alert("Senha redefinida", "Sua senha foi alterada com sucesso!", [
        { text: "Entrar", onPress: () => router.replace("/(auth)/login") },
      ]);
    } catch {
      Alert.alert("Erro", "Falha na conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient colors={["rgba(0,200,255,0.06)", "transparent"]} style={styles.topGlow} pointerEvents="none" />
      <KeyboardAwareScrollViewCompat
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </Pressable>

        <View style={[styles.iconWrap, { backgroundColor: colors.muted, borderRadius: 40 }]}>
          <Feather name="lock" size={36} color={colors.primary} />
        </View>

        <Text style={[styles.title, { color: colors.foreground }]}>Recuperar senha</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          Informe seu CPF e telefone cadastrados para redefinir sua senha.
        </Text>

        <View style={styles.fields}>
          <PremiumInput
            label="CPF"
            placeholder="000.000.000-00"
            value={cpf}
            onChangeText={(t) => setCpf(formatCpf(t))}
            keyboardType="numeric"
            leftIcon="user"
          />
          <PremiumInput
            label="Telefone cadastrado"
            placeholder="(11) 99999-9999"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            leftIcon="phone"
          />
          <PremiumInput
            label="Nova senha"
            placeholder="Mínimo 6 caracteres"
            value={newPassword}
            onChangeText={setNewPassword}
            leftIcon="lock"
            isPassword
          />
          <PremiumInput
            label="Confirmar nova senha"
            placeholder="Repita a senha"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            leftIcon="check-square"
            isPassword
          />
        </View>

        <PremiumButton title="Redefinir senha" onPress={handleSubmit} loading={loading} />
      </KeyboardAwareScrollViewCompat>
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
  fields: { gap: 16, marginBottom: 24 },
});
