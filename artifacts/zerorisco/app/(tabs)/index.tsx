import { router } from "expo-router";
  import React, { useEffect, useState } from "react";
  import {
    ActivityIndicator,
    Alert,
    Linking,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
  } from "react-native";
  import { useSafeAreaInsets } from "react-native-safe-area-context";
  import { Feather } from "@expo/vector-icons";
  import { LinearGradient } from "expo-linear-gradient";
  import { useAuth } from "@/context/AuthContext";
  import { useColors } from "@/hooks/useColors";

  interface PendingSubscription {
    id: number;
    userId: number;
    vehicleModel: string | null;
    vehiclePlate: string | null;
    status: string;
  }

  export default function AdminDashboard() {
    const colors = useColors();
    const insets = useSafeAreaInsets();
    const { user, logout, token } = useAuth();
    const [pending, setPending] = useState<PendingSubscription[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
      fetchPendingSubscriptions();
    }, []);

    const fetchPendingSubscriptions = async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `https://${process.env.EXPO_PUBLIC_DOMAIN}/api/subscription/pending`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (res.ok) {
          const data = await res.json();
          setPending(data.drivers ?? []);
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    };

    const openWebPanel = () => {
      Linking.openURL(`https://${process.env.EXPO_PUBLIC_DOMAIN}/api/admin/panel`);
    };

    const handleLogout = () => {
      Alert.alert("Sair", "Deseja sair da conta admin?", [
        { text: "Cancelar", style: "cancel" },
        { text: "Sair", style: "destructive", onPress: logout },
      ]);
    };

    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <LinearGradient
          colors={["rgba(0,200,255,0.08)", "transparent"]}
          style={styles.bgGlow}
          pointerEvents="none"
        />

        <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
          <View>
            <Text style={[styles.greeting, { color: colors.mutedForeground }]}>Bem-vindo,</Text>
            <Text style={[styles.title, { color: colors.foreground }]}>Administrador</Text>
          </View>
          <Pressable
            onPress={handleLogout}
            style={[styles.logoutBtn, { borderColor: colors.cardBorder }]}
          >
            <Feather name="log-out" size={18} color={colors.mutedForeground} />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Switch to passenger mode */}
          <Pressable
            onPress={() => router.replace("/(passenger)")}
            style={[styles.switchCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
          >
            <View style={[styles.switchIcon, { backgroundColor: "#00FF9D22" }]}>
              <Feather name="user" size={20} color="#00FF9D" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.switchTitle, { color: colors.foreground }]}>
                Acessar como Passageiro
              </Text>
              <Text style={[styles.switchSubtitle, { color: colors.mutedForeground }]}>
                Navegar pela experiência do passageiro
              </Text>
            </View>
            <Feather name="arrow-right" size={18} color="#00FF9D" />
          </Pressable>

          {/* Web Panel CTA */}
          <Pressable
            onPress={openWebPanel}
            style={[styles.panelCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
          >
            <LinearGradient
              colors={["#00C8FF22", "transparent"]}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.panelRow}>
              <View style={[styles.panelIcon, { backgroundColor: colors.primary + "22" }]}>
                <Feather name="monitor" size={22} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.panelTitle, { color: colors.foreground }]}>
                  Painel Web Completo
                </Text>
                <Text style={[styles.panelSubtitle, { color: colors.mutedForeground }]}>
                  Motoristas, corridas e financeiro
                </Text>
              </View>
              <Feather name="external-link" size={18} color={colors.primary} />
            </View>
          </Pressable>

          {/* Pending subscriptions */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                Assinaturas Pendentes
              </Text>
              {loading ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <View
                  style={[
                    styles.badge,
                    {
                      backgroundColor:
                        pending.length > 0 ? colors.destructive + "22" : colors.muted,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.badgeText,
                      {
                        color:
                          pending.length > 0 ? colors.destructive : colors.mutedForeground,
                      },
                    ]}
                  >
                    {pending.length}
                  </Text>
                </View>
              )}
            </View>

            {!loading && pending.length === 0 && (
              <View
                style={[
                  styles.emptyCard,
                  { backgroundColor: colors.card, borderColor: colors.cardBorder },
                ]}
              >
                <Feather name="check-circle" size={24} color={colors.mutedForeground} />
                <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                  Nenhuma assinatura pendente
                </Text>
              </View>
            )}

            {!loading &&
              pending.map((driver) => (
                <Pressable
                  key={driver.id}
                  onPress={openWebPanel}
                  style={[
                    styles.driverCard,
                    { backgroundColor: colors.card, borderColor: colors.cardBorder },
                  ]}
                >
                  <View style={styles.driverRow}>
                    <View
                      style={[
                        styles.driverAvatar,
                        { backgroundColor: colors.primary + "22" },
                      ]}
                    >
                      <Feather name="user" size={18} color={colors.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.driverName, { color: colors.foreground }]}>
                        Motorista ID #{driver.userId}
                      </Text>
                      <Text style={[styles.driverInfo, { color: colors.mutedForeground }]}>
                        {driver.vehicleModel ?? "—"} · {driver.vehiclePlate ?? "—"}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.pendingBadge,
                        { backgroundColor: "#FF950022", borderColor: "#FF950044" },
                      ]}
                    >
                      <Text style={[styles.pendingText, { color: "#FF9500" }]}>
                        Pendente
                      </Text>
                    </View>
                  </View>
                </Pressable>
              ))}
          </View>

          {/* Quick actions */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              Ações Rápidas
            </Text>
            {(
              [
                { icon: "users" as const, label: "Aprovar Motoristas", sub: "Gerenciar cadastros pendentes" },
                { icon: "credit-card" as const, label: "Ativar Assinaturas", sub: "Confirmar pagamentos PIX" },
                { icon: "bar-chart-2" as const, label: "Financeiro", sub: "Volume de corridas e comissões" },
                { icon: "map" as const, label: "Corridas Recentes", sub: "Monitorar todas as viagens" },
              ] as const
            ).map((item) => (
              <Pressable
                key={item.label}
                onPress={openWebPanel}
                style={[
                  styles.quickCard,
                  { backgroundColor: colors.card, borderColor: colors.cardBorder },
                ]}
              >
                <View style={[styles.quickIcon, { backgroundColor: colors.muted }]}>
                  <Feather name={item.icon} size={18} color={colors.foreground} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.quickLabel, { color: colors.foreground }]}>
                    {item.label}
                  </Text>
                  <Text style={[styles.quickSub, { color: colors.mutedForeground }]}>
                    {item.sub}
                  </Text>
                </View>
                <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
              </Pressable>
            ))}
          </View>
        </ScrollView>
      </View>
    );
  }

  const styles = StyleSheet.create({
    container: { flex: 1 },
    bgGlow: { position: "absolute", inset: 0 },
    header: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      paddingHorizontal: 24,
      paddingBottom: 20,
    },
    greeting: { fontSize: 13, fontFamily: "Inter_400Regular", marginBottom: 2 },
    title: { fontSize: 26, fontFamily: "Inter_700Bold" },
    logoutBtn: { padding: 10, borderRadius: 10, borderWidth: 1, marginTop: 4 },
    content: { paddingHorizontal: 20, gap: 16 },
    switchCard: {
      borderRadius: 16,
      borderWidth: 1,
      padding: 16,
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      borderColor: "#00FF9D44",
    },
    switchIcon: {
      width: 44,
      height: 44,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
    },
    switchTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold", marginBottom: 2 },
    switchSubtitle: { fontSize: 12, fontFamily: "Inter_400Regular" },
    panelCard: { borderRadius: 16, borderWidth: 1, padding: 18, overflow: "hidden" },
    panelRow: { flexDirection: "row", alignItems: "center", gap: 14 },
    panelIcon: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
    panelTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold", marginBottom: 2 },
    panelSubtitle: { fontSize: 13, fontFamily: "Inter_400Regular" },
    section: { gap: 10 },
    sectionHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 2,
    },
    sectionTitle: { fontSize: 17, fontFamily: "Inter_700Bold" },
    badge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10 },
    badgeText: { fontSize: 12, fontFamily: "Inter_700Bold" },
    emptyCard: { borderRadius: 12, borderWidth: 1, padding: 24, alignItems: "center", gap: 10 },
    emptyText: { fontSize: 14, fontFamily: "Inter_400Regular" },
    driverCard: { borderRadius: 12, borderWidth: 1, padding: 14 },
    driverRow: { flexDirection: "row", alignItems: "center", gap: 12 },
    driverAvatar: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
    driverName: { fontSize: 14, fontFamily: "Inter_600SemiBold", marginBottom: 2 },
    driverInfo: { fontSize: 12, fontFamily: "Inter_400Regular" },
    pendingBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1 },
    pendingText: { fontSize: 11, fontFamily: "Inter_700Bold" },
    quickCard: {
      borderRadius: 12,
      borderWidth: 1,
      padding: 14,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    quickIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
    quickLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold", marginBottom: 2 },
    quickSub: { fontSize: 12, fontFamily: "Inter_400Regular" },
  });