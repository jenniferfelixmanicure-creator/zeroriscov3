import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PremiumButton } from "@/components/PremiumButton";
import { PremiumInput } from "@/components/PremiumInput";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

function formatCpf(raw: string) {
  const digits = raw.replace(/\D/g, "").slice(0, 11);
  return digits
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/(\d{3})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3-$4");
}

export default function LoginScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { login } = useAuth();

  const [cpf, setCpf] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleCpfChange = (text: string) => setCpf(formatCpf(text));

  const handleLogin = async () => {
    const rawCpf = cpf.replace(/\D/g, "");
    if (rawCpf.length !== 11 || !password) {
      Alert.alert("Atenção", "Preencha o CPF e a senha.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`https://${process.env.EXPO_PUBLIC_DOMAIN}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cpf: rawCpf, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        Alert.alert("Erro", data.error ?? "Credenciais inválidas");
        return;
      }
      await login(data.token, data.user);
      if (data.user.role === "driver") {
        if (data.user.approvalStatus === "approved") {
          router.replace("/(driver)");
        } else {
          router.replace("/(driver)/pending");
        }
      } else {
        router.replace("/(passenger)");
      }
    } catch {
      Alert.alert("Erro", "Falha na conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={["rgba(0,200,255,0.08)", "transparent"]}
        style={styles.topGlow}
        pointerEvents="none"
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 24 },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.logoSection}>
            <Image
              source={require("../../assets/images/icon.png")}
              style={styles.logo}
              resizeMode="contain"
            />
            <Text style={[styles.brand, { color: colors.primary }]}>ZeroRisco</Text>
            <Text style={[styles.tagline, { color: colors.mutedForeground }]}>
              Mobilidade urbana premium
            </Text>
          </View>

          <View style={styles.form}>
            <Text style={[styles.title, { color: colors.foreground }]}>Bem Vindo</Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
              Entre com seu CPF e senha
            </Text>

            <View style={styles.fields}>
              <PremiumInput
                label="CPF"
                placeholder="000.000.000-00"
                value={cpf}
                onChangeText={handleCpfChange}
                keyboardType="numeric"
                leftIcon="user"
              />
              <PremiumInput
                label="Senha"
                placeholder="Sua senha"
                value={password}
                onChangeText={setPassword}
                leftIcon="lock"
                isPassword
              />
            </View>

            <TouchableOpacity
              onPress={() => router.push("/(auth)/forgot-password")}
              style={styles.forgotBtn}
            >
              <Text style={[styles.forgotText, { color: colors.primary }]}>
                Esqueceu a senha?
              </Text>
            </TouchableOpacity>

            <PremiumButton
              title="Entrar"
              onPress={handleLogin}
              loading={loading}
              style={styles.loginBtn}
            />

            <View style={styles.divider}>
              <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
              <Text style={[styles.dividerText, { color: colors.mutedForeground }]}>ou</Text>
              <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
            </View>

            <PremiumButton
              title="Criar conta"
              onPress={() => router.push("/(auth)/register")}
              variant="secondary"
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topGlow: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 300,
    zIndex: 0,
  },
  scroll: { paddingHorizontal: 24, flexGrow: 1 },
  logoSection: { alignItems: "center", marginBottom: 40 },
  logo: { width: 80, height: 80, borderRadius: 20, marginBottom: 12 },
  brand: { fontSize: 28, fontFamily: "Inter_700Bold", letterSpacing: 1 },
  tagline: { fontSize: 14, fontFamily: "Inter_400Regular", marginTop: 4 },
  form: { gap: 0 },
  title: { fontSize: 26, fontFamily: "Inter_700Bold", marginBottom: 6 },
  subtitle: { fontSize: 15, fontFamily: "Inter_400Regular", marginBottom: 28 },
  fields: { gap: 16, marginBottom: 12 },
  forgotBtn: { alignSelf: "flex-end", marginBottom: 24 },
  forgotText: { fontSize: 14, fontFamily: "Inter_500Medium" },
  loginBtn: { marginBottom: 20 },
  divider: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 20 },
  dividerLine: { flex: 1, height: 1 },
  dividerText: { fontSize: 13, fontFamily: "Inter_400Regular" },
});
