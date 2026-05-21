import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { GlowView } from "@/components/GlowView";
import { PremiumButton } from "@/components/PremiumButton";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

interface Transaction {
  id: number;
  type: string;
  description: string;
  amount: number;
  createdAt: string;
}

interface WalletSummary {
  balance: number;
  totalSpent: number;
  totalRides: number;
}

export default function WalletScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [summary, setSummary] = useState<WalletSummary>({ balance: 0, totalSpent: 0, totalRides: 0 });

  const fetchData = useCallback(async () => {
    try {
      const [summaryRes, txRes] = await Promise.all([
        fetch(`https://${process.env.EXPO_PUBLIC_DOMAIN}/api/wallet`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`https://${process.env.EXPO_PUBLIC_DOMAIN}/api/wallet/transactions`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (summaryRes.ok) {
        const data = await summaryRes.json();
        setSummary({ balance: data.balance ?? 0, totalSpent: data.totalSpent ?? 0, totalRides: data.totalRides ?? 0 });
      }

      if (txRes.ok) {
        const data = await txRes.json();
        setTransactions(data);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const handleAddCredits = () => {
    Alert.alert("Adicionar Créditos", "Escolha o valor que deseja adicionar via PIX.");
  };

  const formatCurrency = (val: number) => `R$ ${Math.abs(val).toFixed(2).replace(".", ",")}`;
  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", hour: '2-digit', minute: '2-digit' });

  const getIcon = (type: string) => {
    if (type === "credit") return "plus-circle";
    if (type === "debit") return "navigation";
    if (type === "withdrawal") return "arrow-up-circle";
    return "clock";
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, alignItems: "center", justifyContent: "center" }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient colors={["rgba(0,200,255,0.08)", "transparent"]} style={styles.bgGlow} pointerEvents="none" />

      <FlatList
        data={transactions}
        keyExtractor={(item) => String(item.id)}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        ListHeaderComponent={
          <View style={{ paddingHorizontal: 20, paddingTop: insets.top + 16 }}>
            <View style={styles.header}>
              <Pressable onPress={() => router.back()} style={styles.backBtn}>
                <Feather name="arrow-left" size={22} color={colors.foreground} />
              </Pressable>
              <Text style={[styles.title, { color: colors.foreground }]}>Minha Carteira</Text>
            </View>

            <GlowView glowColor={colors.primary} glowIntensity="medium" style={styles.balanceCard}>
              <Text style={[styles.balanceLabel, { color: colors.mutedForeground }]}>Saldo disponível</Text>
              <Text style={[styles.balanceValue, { color: colors.foreground }]}>
                R$ {summary.balance.toFixed(2).replace(".", ",")}
              </Text>
              <View style={styles.cashbackBadge}>
                <Feather name="gift" size={12} color={colors.success} />
                <Text style={[styles.cashbackText, { color: colors.success }]}>5% de Cashback em todas as corridas</Text>
              </View>
            </GlowView>

            <View style={styles.statsRow}>
              <View style={[styles.statItem, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                <Feather name="trending-down" size={14} color={colors.destructive} />
                <Text style={[styles.statValue, { color: colors.foreground }]}>
                  R$ {summary.totalSpent.toFixed(2).replace(".", ",")}
                </Text>
                <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Gasto total</Text>
              </View>
              <View style={[styles.statItem, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                <Feather name="navigation" size={14} color={colors.primary} />
                <Text style={[styles.statValue, { color: colors.foreground }]}>{summary.totalRides}</Text>
                <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Corridas</Text>
              </View>
            </View>

            <View style={styles.actionsRow}>
              <PremiumButton
                title="Adicionar via PIX"
                variant="success"
                onPress={handleAddCredits}
                style={{ flex: 1 }}
              />
            </View>

            {transactions.length > 0 && (
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Histórico recente</Text>
            )}
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Feather name="inbox" size={48} color={colors.border} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Sem transações</Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              Suas movimentações aparecerão aqui
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={{ paddingHorizontal: 20, marginBottom: 12 }}>
            <View style={[styles.historyItem, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
              <View style={[styles.historyIcon, { backgroundColor: colors.muted }]}>
                <Feather
                  name={getIcon(item.type) as any}
                  size={16}
                  color={item.amount > 0 ? colors.success : colors.primary}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.historyLabel, { color: colors.foreground }]}>{item.description}</Text>
                <Text style={[styles.historyDate, { color: colors.mutedForeground }]}>{formatDate(item.createdAt)}</Text>
              </View>
              <Text style={[styles.historyValue, { color: item.amount > 0 ? colors.success : colors.foreground }]}>
                {item.amount > 0 ? '+' : '-'} {formatCurrency(item.amount)}
              </Text>
            </View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  bgGlow: { position: "absolute", inset: 0 },
  header: { flexDirection: "row", alignItems: "center", marginBottom: 24 },
  backBtn: { padding: 4, marginRight: 12 },
  title: { fontSize: 20, fontFamily: "Inter_700Bold" },
  balanceCard: { padding: 24, alignItems: 'center', marginBottom: 16 },
  balanceLabel: { fontSize: 14, fontFamily: "Inter_400Regular", marginBottom: 8 },
  balanceValue: { fontSize: 36, fontFamily: "Inter_700Bold", marginBottom: 16 },
  cashbackBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(0, 255, 157, 0.1)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  cashbackText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  statsRow: { flexDirection: "row", gap: 12, marginBottom: 16 },
  statItem: { flex: 1, padding: 14, borderRadius: 16, borderWidth: 1, alignItems: "center", gap: 6 },
  statValue: { fontSize: 16, fontFamily: "Inter_700Bold" },
  statLabel: { fontSize: 11, fontFamily: "Inter_400Regular" },
  actionsRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  sectionTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold", marginBottom: 16 },
  historyItem: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 16, borderWidth: 1, gap: 12 },
  historyIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  historyLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  historyDate: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  historyValue: { fontSize: 14, fontFamily: "Inter_700Bold" },
  emptyState: { alignItems: "center", paddingVertical: 60, gap: 12 },
  emptyTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold" },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center" },
});
