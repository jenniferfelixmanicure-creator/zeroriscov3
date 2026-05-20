import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

export default function PendingScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, logout, token } = useAuth();
  const [status, setStatus] = useState(user?.approvalStatus ?? "pending");
  const [checking, setChecking] = useState(false);

  const checkStatus = async () => {
    setChecking(true);
    try {
      const res = await fetch(`https://${process.env.EXPO_PUBLIC_DOMAIN}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.approvalStatus === "approved") {
        router.replace("/(driver)");
      } else {
        setStatus(data.approvalStatus ?? "pending");
      }
    } catch {
      // silent
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    const interval = setInterval(checkStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const isRejected = status === "rejected";

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={["rgba(0,200,255,0.06)", "transparent"]}
        style={styles.glow}
        pointerEvents="none"
      />

      <View style={[styles.content, { paddingTop: insets.top + 60, paddingBottom: insets.bottom + 40 }]}>
        <View style={[styles.iconWrap, { backgroundColor: isRejected ? "#FF3A6E22" : "#00C8FF22" }]}>
          <Feather
            name={isRejected ? "x-circle" : "clock"}
            size={52}
            color={isRejected ? colors.destructive : colors.primary}
          />
        </View>

        <Text style={[styles.title, { color: colors.foreground }]}>
          {isRejected ? "Cadastro Rejeitado" : "Aguardando Aprovação"}
        </Text>

        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          {isRejected
            ? "Seu cadastro foi rejeitado pelo time ZeroRisco. Entre em contato para mais informações."
            : "Seu cadastro está em análise. Assim que aprovado, você receberá acesso ao app de motorista."}
        </Text>

        {!isRejected && (
          <View style={[styles.stepsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.stepsTitle, { color: colors.primary }]}>O que acontece agora?</Text>
            {[
              { icon: "file-text", text: "Nosso time analisa seus documentos" },
              { icon: "check-circle", text: "Você será notificado após aprovação" },
              { icon: "smartphone", text: "Acesse o app e comece a dirigir" },
            ].map((step, i) => (
              <View key={i} style={styles.step}>
                <View style={[styles.stepIcon, { backgroundColor: colors.primary + "22" }]}>
                  <Feather name={step.icon as any} size={16} color={colors.primary} />
                </View>
                <Text style={[styles.stepText, { color: colors.mutedForeground }]}>{step.text}</Text>
              </View>
            ))}
          </View>
        )}

        <TouchableOpacity
          style={[styles.checkBtn, { borderColor: colors.primary }]}
          onPress={checkStatus}
          disabled={checking}
        >
          {checking ? (
            <ActivityIndicator color={colors.primary} size="small" />
          ) : (
            <>
              <Feather name="refresh-cw" size={16} color={colors.primary} />
              <Text style={[styles.checkBtnText, { color: colors.primary }]}>Verificar status</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={logout} style={styles.logoutBtn}>
          <Text style={[styles.logoutText, { color: colors.mutedForeground }]}>Sair da conta</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  glow: { position: "absolute", top: 0, left: 0, right: 0, height: 250 },
  content: { flex: 1, paddingHorizontal: 28, alignItems: "center", justifyContent: "center" },
  iconWrap: { width: 100, height: 100, borderRadius: 50, alignItems: "center", justifyContent: "center", marginBottom: 24 },
  title: { fontSize: 24, fontFamily: "Inter_700Bold", textAlign: "center", marginBottom: 12 },
  subtitle: { fontSize: 15, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 22, marginBottom: 28 },
  stepsCard: { borderRadius: 16, borderWidth: 1, padding: 20, width: "100%", gap: 14, marginBottom: 28 },
  stepsTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold", marginBottom: 4 },
  step: { flexDirection: "row", alignItems: "center", gap: 12 },
  stepIcon: { width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  stepText: { fontSize: 14, fontFamily: "Inter_400Regular", flex: 1 },
  checkBtn: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 12, marginBottom: 20 },
  checkBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  logoutBtn: { padding: 8 },
  logoutText: { fontSize: 14, fontFamily: "Inter_400Regular" },
});
