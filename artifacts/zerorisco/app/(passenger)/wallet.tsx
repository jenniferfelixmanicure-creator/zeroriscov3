import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { GlowView } from "@/components/GlowView";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

interface WalletInfo {
  balance: number;
  totalSpent: number;
  totalRides: number;
}

interface TransactionInfo {
  id: number;
  type: string;
  amount: number;
  description: string;
  createdAt: string;
}

export default function WalletScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const [wallet, setWallet] = useState<WalletInfo | null>(null);
  const [transactions, setTransactions] = useState<TransactionInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchWallet();
  }, []);

  const fetchWallet = async () => {
    setLoading(true);
    try {
      const [walletRes, txRes] = await Promise.all([
        fetch(`https://${process.env.EXPO_PUBLIC_DOMAIN}/api/wallet`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`https://${process.env.EXPO_PUBLIC_DOMAIN}/api/wallet/transactions`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);
      if (walletRes.ok) setWallet(await walletRes.json());
      if (txRes.ok) setTransactions(await txRes.json());
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (val: number) => `R$ ${val.toFixed(2).replace(".", ",")}`;
  const formatDate = (d: string) => new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        data={transactions}
        keyExtractor={(item) => String(item.id)}
        onRefresh={fetchWallet}
        refreshing={loading}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
        ListHeaderComponent={
          <View style={{ paddingHorizontal: 20, paddingTop: insets.top + 16 }}>
            <Text style={[styles.title, { color: colors.foreground }]}>Carteira</Text>

            {/* Balance card */}
            <LinearGradient
              colors={["#00C8FF", "#0044BB"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.balanceCard, { borderRadius: colors.radius + 4 }]}
            >
              <View style={styles.balanceTop}>
                <Text style={styles.balanceLabel}>Saldo disponível</Text>
                <Feather name="credit-card" size={24} color="rgba(255,255,255,0.7)" />
              </View>
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.balanceAmount}>
                  {formatCurrency(wallet?.balance ?? 0)}
                </Text>
              )}
              <View style={styles.balanceStats}>
                <View>
                  <Text style={styles.statLabel}>Total gasto</Text>
                  <Text style={styles.statValue}>{formatCurrency(wallet?.totalSpent ?? 0)}</Text>
                </View>
                <View style={styles.statDivider} />
                <View>
                  <Text style={styles.statLabel}>Viagens</Text>
                  <Text style={styles.statValue}>{wallet?.totalRides ?? 0}</Text>
                </View>
              </View>
            </LinearGradient>

            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Extrato</Text>

            {transactions.length === 0 && !loading && (
              <View style={styles.empty}>
                <Feather name="credit-card" size={40} color={colors.border} />
                <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                  Sem transações ainda
                </Text>
              </View>
            )}
          </View>
        }
        renderItem={({ item }) => (
          <GlowView
            style={[styles.txCard, { marginHorizontal: 20 }]}
            noBorder={item.type !== "credit"}
            glowColor={item.type === "credit" ? colors.success : undefined}
          >
            <Feather
              name={item.type === "credit" ? "arrow-down-circle" : "arrow-up-circle"}
              size={22}
              color={item.type === "credit" ? colors.success : colors.destructive}
            />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[styles.txDesc, { color: colors.foreground }]}>{item.description}</Text>
              <Text style={[styles.txDate, { color: colors.mutedForeground }]}>{formatDate(item.createdAt)}</Text>
            </View>
            <Text
              style={[
                styles.txAmount,
                { color: item.type === "credit" ? colors.success : colors.destructive },
              ]}
            >
              {item.type === "credit" ? "+" : "-"}{formatCurrency(Math.abs(item.amount))}
            </Text>
          </GlowView>
        )}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  title: { fontSize: 24, fontFamily: "Inter_700Bold", marginBottom: 20 },
  balanceCard: { padding: 24, marginBottom: 28 },
  balanceTop: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  balanceLabel: { color: "rgba(255,255,255,0.7)", fontSize: 13, fontFamily: "Inter_500Medium" },
  balanceAmount: { color: "#fff", fontSize: 36, fontFamily: "Inter_700Bold", marginBottom: 20 },
  balanceStats: { flexDirection: "row", alignItems: "center", gap: 24 },
  statLabel: { color: "rgba(255,255,255,0.6)", fontSize: 11, fontFamily: "Inter_400Regular", marginBottom: 2 },
  statValue: { color: "#fff", fontSize: 16, fontFamily: "Inter_600SemiBold" },
  statDivider: { width: 1, height: 32, backgroundColor: "rgba(255,255,255,0.2)" },
  sectionTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold", marginBottom: 14 },
  txCard: { flexDirection: "row", alignItems: "center", padding: 14 },
  txDesc: { fontSize: 14, fontFamily: "Inter_500Medium", marginBottom: 2 },
  txDate: { fontSize: 12, fontFamily: "Inter_400Regular" },
  txAmount: { fontSize: 15, fontFamily: "Inter_700Bold" },
  empty: { alignItems: "center", gap: 12, paddingVertical: 40 },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular" },
});
