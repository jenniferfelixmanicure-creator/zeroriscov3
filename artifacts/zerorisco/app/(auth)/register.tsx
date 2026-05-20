import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { PremiumButton } from "@/components/PremiumButton";
import { PremiumInput } from "@/components/PremiumInput";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

type Role = "passenger" | "driver";

function formatCpf(raw: string) {
  const digits = raw.replace(/\D/g, "").slice(0, 11);
  return digits
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/(\d{3})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3-$4");
}

interface DocPickerProps {
  label: string;
  icon: string;
  uri: string | null;
  onPick: () => void;
  colors: ReturnType<typeof useColors>;
}

function DocPicker({ label, icon, uri, onPick, colors }: DocPickerProps) {
  return (
    <TouchableOpacity
      onPress={onPick}
      style={[
        styles.docBtn,
        {
          backgroundColor: colors.card,
          borderColor: uri ? colors.primary : colors.border,
          borderWidth: 1.5,
        },
      ]}
    >
      {uri ? (
        <Image source={{ uri }} style={styles.docPreview} resizeMode="cover" />
      ) : (
        <>
          <View style={[styles.docIconWrap, { backgroundColor: colors.primary + "22" }]}>
            <Feather name={icon as any} size={24} color={colors.primary} />
          </View>
          <Text style={[styles.docLabel, { color: colors.mutedForeground }]}>{label}</Text>
          <Text style={[styles.docHint, { color: colors.primary }]}>Toque para enviar</Text>
        </>
      )}
      {uri && (
        <View style={styles.docDone}>
          <Feather name="check-circle" size={20} color={colors.accent} />
          <Text style={[styles.docDoneText, { color: colors.accent }]}>{label} ✓</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

export default function RegisterScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { login } = useAuth();

  const [role, setRole] = useState<Role>("passenger");
  const [name, setName] = useState("");
  const [cpf, setCpf] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [vehicleModel, setVehicleModel] = useState("");
  const [vehiclePlate, setVehiclePlate] = useState("");
  const [cnhUri, setCnhUri] = useState<string | null>(null);
  const [cnhBase64, setCnhBase64] = useState<string | null>(null);
  const [crlvUri, setCrlvUri] = useState<string | null>(null);
  const [crlvBase64, setCrlvBase64] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleCpfChange = (text: string) => setCpf(formatCpf(text));

  const pickImage = async (
    setter: (uri: string) => void,
    base64Setter: (b64: string) => void
  ) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permissão necessária", "Precisamos de acesso à sua galeria para enviar documentos.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images",
      quality: 0.7,
      base64: true,
      allowsEditing: true,
    });
    if (!result.canceled && result.assets[0]) {
      setter(result.assets[0].uri);
      base64Setter(`data:image/jpeg;base64,${result.assets[0].base64 ?? ""}`);
    }
  };

  const handleRegister = async () => {
    const rawCpf = cpf.replace(/\D/g, "");
    if (!name || rawCpf.length !== 11 || !phone || !password) {
      Alert.alert("Atenção", "Preencha todos os campos obrigatórios.");
      return;
    }
    if (role === "driver" && (!vehicleModel || !vehiclePlate)) {
      Alert.alert("Atenção", "Informe o modelo e a placa do veículo.");
      return;
    }
    if (role === "driver" && (!cnhBase64 || !crlvBase64)) {
      Alert.alert("Documentos obrigatórios", "Envie a CNH e o CRLV para continuar.");
      return;
    }

    setLoading(true);
    try {
      const body: Record<string, unknown> = {
        name,
        cpf: rawCpf,
        phone,
        password,
        role,
        vehicleModel,
        vehiclePlate,
      };
      if (role === "driver") {
        body["cnhBase64"] = cnhBase64;
        body["crlvBase64"] = crlvBase64;
      }

      const res = await fetch(`https://${process.env.EXPO_PUBLIC_DOMAIN}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        Alert.alert("Erro", data.error ?? "Falha no cadastro");
        return;
      }
      await login(data.token, data.user);
      if (role === "driver") {
        router.replace("/(driver)/pending");
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
            <PremiumInput
              label="Nome completo"
              placeholder="Seu nome"
              value={name}
              onChangeText={setName}
              leftIcon="user"
            />
            <PremiumInput
              label="CPF"
              placeholder="000.000.000-00"
              value={cpf}
              onChangeText={handleCpfChange}
              keyboardType="numeric"
              leftIcon="credit-card"
            />
            <PremiumInput
              label="Telefone"
              placeholder="(11) 99999-9999"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              leftIcon="phone"
            />
            <PremiumInput
              label="Senha"
              placeholder="Mínimo 6 caracteres"
              value={password}
              onChangeText={setPassword}
              leftIcon="lock"
              isPassword
            />

            {role === "driver" && (
              <>
                <View style={[styles.sectionHeader, { borderTopColor: colors.border }]}>
                  <Feather name="truck" size={15} color={colors.primary} />
                  <Text style={[styles.sectionLabel, { color: colors.primary }]}>
                    Dados do veículo
                  </Text>
                </View>
                <PremiumInput
                  label="Modelo do veículo"
                  placeholder="Ex: Honda Civic 2022"
                  value={vehicleModel}
                  onChangeText={setVehicleModel}
                  leftIcon="truck"
                />
                <PremiumInput
                  label="Placa"
                  placeholder="ABC-1D23"
                  value={vehiclePlate}
                  onChangeText={setVehiclePlate}
                  autoCapitalize="characters"
                  leftIcon="hash"
                />

                <View style={[styles.sectionHeader, { borderTopColor: colors.border }]}>
                  <Feather name="file-text" size={15} color={colors.primary} />
                  <Text style={[styles.sectionLabel, { color: colors.primary }]}>
                    Documentos para aprovação
                  </Text>
                </View>
                <Text style={[styles.docsInfo, { color: colors.mutedForeground }]}>
                  Envie foto legível da CNH e do CRLV do veículo. Sua conta será revisada pelo time ZeroRisco.
                </Text>
                <View style={styles.docsRow}>
                  <DocPicker
                    label="CNH"
                    icon="credit-card"
                    uri={cnhUri}
                    onPick={() => pickImage(setCnhUri, setCnhBase64)}
                    colors={colors}
                  />
                  <DocPicker
                    label="CRLV"
                    icon="file-text"
                    uri={crlvUri}
                    onPick={() => pickImage(setCrlvUri, setCrlvBase64)}
                    colors={colors}
                  />
                </View>
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
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 8, borderTopWidth: 1, paddingTop: 16, marginTop: 4 },
  sectionLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  docsInfo: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18, marginTop: -4 },
  docsRow: { flexDirection: "row", gap: 12 },
  docBtn: { flex: 1, borderRadius: 14, padding: 16, alignItems: "center", gap: 8, minHeight: 130 },
  docIconWrap: { width: 48, height: 48, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  docLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  docHint: { fontSize: 12, fontFamily: "Inter_400Regular" },
  docPreview: { width: "100%", height: 100, borderRadius: 10 },
  docDone: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
  docDoneText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  loginLink: { alignItems: "center", marginTop: 16 },
  loginLinkText: { fontSize: 14, fontFamily: "Inter_400Regular" },
});
