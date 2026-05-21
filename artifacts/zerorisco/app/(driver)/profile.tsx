import { router } from "expo-router";
import React from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { GlowView } from "@/components/GlowView";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

export default function DriverProfile() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    Alert.alert("Sair", "Deseja sair da sua conta?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Sair",
        style: "destructive",
        onPress: async () => {
          await logout();
          router.replace("/(auth)/login");
        },
      },
    ]);
  };

  const initials = user?.name?.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase() ?? "ZR";

  const soon = () => Alert.alert("Em breve", "Esta funcionalidade está sendo desenvolvida.");

  const menuItems = [
    { icon: "user" as const, label: "Editar perfil", onPress: soon },
    { icon: "truck" as const, label: "Dados do veículo", onPress: soon },
    { icon: "file-text" as const, label: "Documentos", onPress: soon },
    { icon: "help-circle" as const, label: "Suporte", onPress: () => Alert.alert("Suporte", "Entre em contato: suporte@zerorisco.app") },
    { icon: "log-out" as const, label: "Sair", onPress: handleLogout, danger: true },
  ];

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
      showsVerticalScrollIndicator={false}
    >
      <LinearGradient
        colors={["rgba(0,200,255,0.1)", "transparent"]}
        style={[styles.headerBg, { paddingTop: insets.top + 16 }]}
      >
        <View style={styles.headerContent}>
          <LinearGradient colors={["#00C8FF", "#0044BB"]} style={[styles.avatar, { borderRadius: 40 }]}>
            <Text style={styles.avatarText}>{initials}</Text>
          </LinearGradient>
          <Text style={[styles.name, { color: colors.foreground }]}>{user?.name}</Text>
          <Text style={[styles.email, { color: colors.mutedForeground }]}>{user?.phone}</Text>
          <View style={[styles.badge, { backgroundColor: colors.muted, borderColor: colors.cardBorder }]}>
            <Feather name="truck" size={12} color={colors.primary} />
            <Text style={[styles.badgeText, { color: colors.primary }]}>Motorista ZeroRisco</Text>
          </View>
        </View>
      </LinearGradient>

      <View style={{ paddingHorizontal: 20, marginTop: 8 }}>
        <GlowView style={{ overflow: "hidden" }}>
          {menuItems.map((item, index) => (
            <Pressable
              key={item.label}
              onPress={item.onPress}
              style={({ pressed }) => [
                styles.menuItem,
                index < menuItems.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border },
                { opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Feather name={item.icon} size={18} color={item.danger ? colors.destructive : colors.primary} />
              <Text style={[styles.menuLabel, { color: item.danger ? colors.destructive : colors.foreground }]}>
                {item.label}
              </Text>
              {!item.danger && <Feather name="chevron-right" size={16} color={colors.mutedForeground} />}
            </Pressable>
          ))}
        </GlowView>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerBg: { paddingBottom: 32 },
  headerContent: { alignItems: "center", paddingHorizontal: 24 },
  avatar: { width: 80, height: 80, alignItems: "center", justifyContent: "center", marginBottom: 14 },
  avatarText: { color: "#fff", fontSize: 28, fontFamily: "Inter_700Bold" },
  name: { fontSize: 22, fontFamily: "Inter_700Bold", marginBottom: 4 },
  email: { fontSize: 14, fontFamily: "Inter_400Regular", marginBottom: 14 },
  badge: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  badgeText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  menuItem: { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 16, paddingHorizontal: 16 },
  menuLabel: { flex: 1, fontSize: 15, fontFamily: "Inter_500Medium" },
});
