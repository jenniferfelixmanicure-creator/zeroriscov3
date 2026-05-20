import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { GlowView } from "@/components/GlowView";
import { PremiumButton } from "@/components/PremiumButton";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

interface Earnings {
  today: number;
  week: number;
  month: number;
  totalRides: number;
  balance: number;
  recentTransactions: Array<{ id: number; type: string; amount: number; description: string; createdAt: string }>;
}

export default function EarningsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const [earnings, setEarnings] = useState<Earnings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEarnings();
  }, []);

  const fetchEarnings = async () => {
    setLoading(true);
    try {
      const res = await fetch(`https://${process.env.EXPO_PUBLIC_DOMAIN}/api/drivers/earnings`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setEarnings(await res.json());
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const fmt = (v: number) => `R$ ${v.toFixed(2).replace(".", ",")}`;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.content, { paddingTop: insets.top + 16 }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>Seus ganhos</Text>

        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 60 }} />
        ) : (
          <>
            <LinearGradient
              colors={["#00C8FF", "#0044BB"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.balanceCard, { borderRadius: colors.radius + 4 }]}
            >
              <Text style={styles.balanceLabel}>Saldo disponível</Text>
              <Text style={styles.balanceAmount}>{fmt(earnings?.balance ?? 0)}</Text>
              <PremiumButton
                title="Solicitar saque"
                variant="secondary"
                size="sm"
                onPress={() => {}}
                style={{ borderColor: "rgba(255,255,255,0.3)", marginTop: 8 }}
              />
            </LinearGradient>

            <View style={styles.statsGrid}>
              {[
                { label: "Hoje", value: fmt(earnings?.today ?? 0), icon: "sun" as const },
                { label: "Esta semana", value: fmt(earnings?.week ?? 0), icon: "calendar" as const },
                { label: "Este mês", value: fmt(earnings?.month ?? 0), icon: "trending-up" as const },
                { label: "Total de corridas", value: String(earnings?.totalRides ?? 0), icon: "navigation" as const },
              ].map((stat) => (
                <GlowView key={stat.label} style={styles.statCard} glowIntensity="low">
                  <Feather name={stat.icon} size={18} color={colors.primary} />
                  <Text style={[styles.statValue, { color: colors.foreground }]}>{stat.value}</Text>
                  <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{stat.label}</Text>
                </GlowView>
              ))}
            </View>

            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Extrato recente</Text>

            {(earnings?.recentTransactions ?? []).length === 0 ? (
              <View style={styles.empty}>
                <Feather name="dollar-sign" size={40} color={colors.border} />
                <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Sem transações ainda</Text>
              </View>
            ) : (
              earnings?.recentTransactions.map((tx) => (
                <GlowView key={tx.id} style={styles.txCard} glowColor={colors.success} glowIntensity="low">
                  <Feather name="arrow-down-circle" size={20} color={colors.success} />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={[styles.txDesc, { color: colors.foreground }]}>{tx.description}</Text>
                    <Text style={[styles.txDate, { color: colors.mutedForeground }]}>
                      {new Date(tx.createdAt).toLocaleDateString("pt-BR")}
                    </Text>
                  </View>
                  <Text style={[styles.txAmount, { color: colors.success }]}>+{fmt(Number(tx.amount))}</Text>
                </GlowView>
              ))
            )}
          </>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 20, gap: 16 },
  title: { fontSize: 24, fontFamily: "Inter_700Bold", marginBottom: 4 },
  balanceCard: { padding: 24 },
  balanceLabel: { color: "rgba(255,255,255,0.7)", fontSize: 13, fontFamily: "Inter_500Medium", marginBottom: 8 },
  balanceAmount: { color: "#fff", fontSize: 36, fontFamily: "Inter_700Bold", marginBottom: 4 },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  statCard: { width: "48%", alignItems: "center", paddingVertical: 16, gap: 6 },
  statValue: { fontSize: 17, fontFamily: "Inter_700Bold" },
  statLabel: { fontSize: 11, fontFamily: "Inter_400Regular", textAlign: "center" },
  sectionTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  txCard: { flexDirection: "row", alignItems: "center", padding: 14, marginBottom: 8 },
  txDesc: { fontSize: 14, fontFamily: "Inter_500Medium", marginBottom: 2 },
  txDate: { fontSize: 12, fontFamily: "Inter_400Regular" },
  txAmount: { fontSize: 15, fontFamily: "Inter_700Bold" },
  empty: { alignItems: "center", gap: 12, paddingVertical: 40 },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular" },
});
