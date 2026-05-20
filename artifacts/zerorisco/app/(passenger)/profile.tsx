import { router } from "expo-router";
import React from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { GlowView } from "@/components/GlowView";
import { PremiumButton } from "@/components/PremiumButton";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

interface MenuItem {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  onPress: () => void;
  danger?: boolean;
}

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    Alert.alert("Sair", "Deseja realmente sair da sua conta?", [
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

  const menuItems: MenuItem[] = [
    { icon: "user", label: "Editar perfil", onPress: () => {} },
    { icon: "shield", label: "Segurança", onPress: () => {} },
    { icon: "bell", label: "Notificações", onPress: () => {} },
    { icon: "help-circle", label: "Suporte", onPress: () => {} },
    { icon: "star", label: "Avaliar o app", onPress: () => {} },
    { icon: "log-out", label: "Sair", onPress: handleLogout, danger: true },
  ];

  const initials = user?.name?.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase() ?? "ZR";

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <LinearGradient
        colors={["rgba(0,200,255,0.12)", "transparent"]}
        style={[styles.headerBg, { paddingTop: insets.top + 16 }]}
      >
        <View style={styles.headerContent}>
          <LinearGradient
            colors={["#00C8FF", "#0044BB"]}
            style={[styles.avatar, { borderRadius: 40 }]}
          >
            <Text style={styles.avatarText}>{initials}</Text>
          </LinearGradient>
          <Text style={[styles.name, { color: colors.foreground }]}>{user?.name}</Text>
          <Text style={[styles.email, { color: colors.mutedForeground }]}>{user?.email}</Text>

          <View style={styles.statsRow}>
            {[
              { label: "Viagens", value: String(user?.totalRides ?? 0) },
              { label: "Avaliação", value: user?.rating ? user.rating.toFixed(1) : "5.0" },
            ].map((stat) => (
              <View key={stat.label} style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                <Text style={[styles.statValue, { color: colors.primary }]}>{stat.value}</Text>
                <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{stat.label}</Text>
              </View>
            ))}
          </View>
        </View>
      </LinearGradient>

      {/* Menu */}
      <View style={styles.menu}>
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
              <Feather
                name={item.icon}
                size={18}
                color={item.danger ? colors.destructive : colors.primary}
              />
              <Text
                style={[styles.menuLabel, { color: item.danger ? colors.destructive : colors.foreground }]}
              >
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
  email: { fontSize: 14, fontFamily: "Inter_400Regular", marginBottom: 20 },
  statsRow: { flexDirection: "row", gap: 12, width: "100%" },
  statCard: { flex: 1, alignItems: "center", paddingVertical: 14, borderRadius: 12, borderWidth: 1 },
  statValue: { fontSize: 20, fontFamily: "Inter_700Bold", marginBottom: 2 },
  statLabel: { fontSize: 12, fontFamily: "Inter_400Regular" },
  menu: { paddingHorizontal: 20, marginTop: 8 },
  menuItem: { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 16, paddingHorizontal: 16 },
  menuLabel: { flex: 1, fontSize: 15, fontFamily: "Inter_500Medium" },
});
