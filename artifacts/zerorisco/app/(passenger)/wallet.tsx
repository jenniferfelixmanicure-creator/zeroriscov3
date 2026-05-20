import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
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
  type: 'ride' | 'cashback' | 'pix';
  description: string;
  amount: number;
  createdAt: string;
}

export default function WalletScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, token } = useAuth();
  const [loading, setLoading] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Simulação de transações enquanto o endpoint real não está pronto
      setTransactions([
        { id: 1, type: 'ride', description: 'Corrida finalizada', amount: -15.90, createdAt: new Date().toISOString() },
        { id: 2, type: 'cashback', description: 'Cashback recebido', amount: 0.80, createdAt: new Date().toISOString() },
        { id: 3, type: 'pix', description: 'Recarga via PIX', amount: 50.00, createdAt: new Date(Date.now() - 86400000).toISOString() },
      ]);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const handleAddCredits = () => {
    Alert.alert("Adicionar Créditos", "Escolha o valor que deseja adicionar via PIX.");
  };

  const formatCurrency = (val: number) => `R$ ${Math.abs(val).toFixed(2).replace(".", ",")}`;
  const formatDate = (d: string) => new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", hour: '2-digit', minute: '2-digit' });

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient colors={["rgba(0,200,255,0.08)", "transparent"]} style={styles.bgGlow} pointerEvents="none" />

      <FlatList
        data={transactions}
        keyExtractor={(item) => String(item.id)}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        ListHeaderComponent={
          <View style={{ paddingHorizontal: 20, paddingTop: insets.top + 16 }}>
            {/* Header */}
            <View style={styles.header}>
              <Pressable onPress={() => router.back()} style={styles.backBtn}>
                <Feather name="arrow-left" size={22} color={colors.foreground} />
              </Pressable>
              <Text style={[styles.title, { color: colors.foreground }]}>Minha Carteira</Text>
            </View>

            {/* Balance Card */}
            <GlowView glowColor={colors.primary} glowIntensity="medium" style={styles.balanceCard}>
              <Text style={[styles.balanceLabel, { color: colors.mutedForeground }]}>Saldo disponível</Text>
              <Text style={[styles.balanceValue, { color: colors.foreground }]}>
                R$ {Number(user?.walletBalance || 0).toFixed(2).replace(".", ",")}
              </Text>
              <View style={styles.cashbackBadge}>
                <Feather name="gift" size={12} color={colors.success} />
                <Text style={[styles.cashbackText, { color: colors.success }]}>5% de Cashback em todas as corridas</Text>
              </View>
            </GlowView>

            {/* Actions */}
            <View style={styles.actionsRow}>
              <PremiumButton
                title="Adicionar via PIX"
                variant="success"
                onPress={handleAddCredits}
                style={{ flex: 1 }}
              />
            </View>

            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Histórico recente</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={{ paddingHorizontal: 20, marginBottom: 12 }}>
            <View style={[styles.historyItem, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
              <View style={[styles.historyIcon, { backgroundColor: colors.muted }]}>
                <Feather 
                  name={item.type === 'ride' ? 'navigation' : item.type === 'cashback' ? 'gift' : 'plus'} 
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
  balanceCard: { padding: 24, alignItems: 'center', marginBottom: 20 },
  balanceLabel: { fontSize: 14, fontFamily: "Inter_400Regular", marginBottom: 8 },
  balanceValue: { fontSize: 36, fontFamily: "Inter_700Bold", marginBottom: 16 },
  cashbackBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(0, 255, 157, 0.1)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  cashbackText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  actionsRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  sectionTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold", marginBottom: 16 },
  historyItem: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 16, borderWidth: 1, gap: 12 },
  historyIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  historyLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  historyDate: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  historyValue: { fontSize: 14, fontFamily: "Inter_700Bold" },
});
