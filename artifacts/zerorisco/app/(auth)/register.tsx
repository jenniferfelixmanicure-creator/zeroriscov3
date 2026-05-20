import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { PremiumButton } from "@/components/PremiumButton";
import { PremiumInput } from "@/components/PremiumInput";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

type Role = "passenger" | "driver";

export default function RegisterScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { login } = useAuth();

  const [role, setRole] = useState<Role>("passenger");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [vehicleModel, setVehicleModel] = useState("");
  const [vehiclePlate, setVehiclePlate] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!name || !email || !phone || !password) {
      Alert.alert("Atenção", "Preencha todos os campos obrigatórios.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`https://${process.env.EXPO_PUBLIC_DOMAIN}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, phone, password, role, vehicleModel, vehiclePlate }),
      });
      const data = await res.json();
      if (!res.ok) {
        Alert.alert("Erro", data.error ?? "Falha no cadastro");
        return;
      }
      await login(data.token, data.user);
      if (role === "driver") {
        router.replace("/(driver)/");
      } else {
        router.replace("/(passenger)/");
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
        colors={["rgba(0,200,255,0.06)", "transparent"]}
        style={styles.topGlow}
        pointerEvents="none"
      />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <Pressable onPress={() => router.back()} style={styles.backBtn}>
              <Feather name="arrow-left" size={22} color={colors.foreground} />
            </Pressable>
            <Text style={[styles.title, { color: colors.foreground }]}>Criar conta</Text>
          </View>

          {/* Role selector */}
          <View style={[styles.roleRow, { backgroundColor: colors.muted, borderRadius: colors.radius }]}>
            {(["passenger", "driver"] as Role[]).map((r) => (
              <Pressable
                key={r}
                onPress={() => setRole(r)}
                style={[
                  styles.roleBtn,
                  role === r && { backgroundColor: colors.primary, borderRadius: colors.radius - 4 },
                ]}
              >
                <Feather
                  name={r === "passenger" ? "user" : "truck"}
                  size={16}
                  color={role === r ? colors.primaryForeground : colors.mutedForeground}
                />
                <Text
                  style={[
                    styles.roleBtnText,
                    { color: role === r ? colors.primaryForeground : colors.mutedForeground },
                  ]}
                >
                  {r === "passenger" ? "Passageiro" : "Motorista"}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.fields}>
            <PremiumInput label="Nome completo" placeholder="Seu nome" value={name} onChangeText={setName} leftIcon="user" />
            <PremiumInput label="E-mail" placeholder="seu@email.com" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" leftIcon="mail" />
            <PremiumInput label="Telefone" placeholder="(11) 99999-9999" value={phone} onChangeText={setPhone} keyboardType="phone-pad" leftIcon="phone" />
            <PremiumInput label="Senha" placeholder="Mínimo 6 caracteres" value={password} onChangeText={setPassword} leftIcon="lock" isPassword />

            {role === "driver" && (
              <>
                <Text style={[styles.sectionLabel, { color: colors.primary }]}>
                  Dados do veículo
                </Text>
                <PremiumInput label="Modelo do veículo" placeholder="Ex: Honda Civic 2022" value={vehicleModel} onChangeText={setVehicleModel} leftIcon="truck" />
                <PremiumInput label="Placa" placeholder="ABC-1234" value={vehiclePlate} onChangeText={setVehiclePlate} autoCapitalize="characters" leftIcon="credit-card" />
              </>
            )}
          </View>

          <PremiumButton title="Criar conta" onPress={handleRegister} loading={loading} />
          <Pressable onPress={() => router.back()} style={styles.loginLink}>
            <Text style={[styles.loginLinkText, { color: colors.mutedForeground }]}>
              Já tem conta?{" "}
              <Text style={{ color: colors.primary }}>Entrar</Text>
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topGlow: { position: "absolute", top: 0, left: 0, right: 0, height: 200 },
  scroll: { paddingHorizontal: 24, flexGrow: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: 16, marginBottom: 28 },
  backBtn: { padding: 4 },
  title: { fontSize: 24, fontFamily: "Inter_700Bold" },
  roleRow: { flexDirection: "row", padding: 4, marginBottom: 24 },
  roleBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 12 },
  roleBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  fields: { gap: 16, marginBottom: 24 },
  sectionLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold", marginTop: 4 },
  loginLink: { alignItems: "center", marginTop: 16 },
  loginLinkText: { fontSize: 14, fontFamily: "Inter_400Regular" },
});
