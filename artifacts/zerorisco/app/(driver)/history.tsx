import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { RideCard } from "@/components/RideCard";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

interface RideInfo {
  id: number;
  categoryName: string;
  categoryIcon: string;
  originAddress: string;
  destinationAddress: string;
  estimatedFare: number;
  finalFare?: number | null;
  status: string;
  createdAt: string;
}

export default function DriverHistory() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const [rides, setRides] = useState<RideInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRides();
  }, []);

  const fetchRides = async () => {
    setLoading(true);
    try {
      const res = await fetch(`https://${process.env.EXPO_PUBLIC_DOMAIN}/api/rides?status=completed`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setRides(await res.json());
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top + 16 }]}>
      <Text style={[styles.title, { color: colors.foreground }]}>Corridas realizadas</Text>
      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 60 }} />
      ) : rides.length === 0 ? (
        <View style={styles.empty}>
          <Feather name="clock" size={48} color={colors.border} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Sem corridas ainda</Text>
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Fique online para receber corridas</Text>
        </View>
      ) : (
        <FlatList
          data={rides}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => <RideCard ride={item} onPress={() => router.push(`/ride/${item.id}`)} />}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 80 }]}
          onRefresh={fetchRides}
          refreshing={loading}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 20 },
  title: { fontSize: 24, fontFamily: "Inter_700Bold", marginBottom: 20 },
  list: { paddingTop: 4 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, marginTop: 100 },
  emptyTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold" },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center" },
});
