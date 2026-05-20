import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
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

interface Props {
  ride: RideInfo;
  onPress?: () => void;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  searching: { label: "Procurando", color: "#FFB800" },
  accepted: { label: "Motorista a caminho", color: "#00C8FF" },
  arrived: { label: "Motorista chegou", color: "#8B5CF6" },
  in_progress: { label: "Em andamento", color: "#00C8FF" },
  completed: { label: "Concluída", color: "#00FF9D" },
  cancelled: { label: "Cancelada", color: "#FF3A6E" },
};

export function RideCard({ ride, onPress }: Props) {
  const colors = useColors();
  const statusInfo = STATUS_LABELS[ride.status] ?? { label: ride.status, color: colors.mutedForeground };
  const fare = ride.finalFare ?? ride.estimatedFare;

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
  };

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.card,
          borderRadius: colors.radius,
          borderWidth: 1,
          borderColor: colors.cardBorder,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <View style={styles.header}>
        <View style={[styles.statusBadge, { backgroundColor: `${statusInfo.color}22` }]}>
          <View style={[styles.statusDot, { backgroundColor: statusInfo.color }]} />
          <Text style={[styles.statusText, { color: statusInfo.color }]}>{statusInfo.label}</Text>
        </View>
        <Text style={[styles.date, { color: colors.mutedForeground }]}>{formatDate(ride.createdAt)}</Text>
      </View>

      <View style={styles.route}>
        <View style={styles.routeRow}>
          <View style={[styles.dot, { backgroundColor: colors.primary }]} />
          <Text style={[styles.address, { color: colors.foreground }]} numberOfLines={1}>
            {ride.originAddress}
          </Text>
        </View>
        <View style={[styles.line, { backgroundColor: colors.border }]} />
        <View style={styles.routeRow}>
          <View style={[styles.dot, { backgroundColor: colors.destructive }]} />
          <Text style={[styles.address, { color: colors.foreground }]} numberOfLines={1}>
            {ride.destinationAddress}
          </Text>
        </View>
      </View>

      <View style={styles.footer}>
        <View style={styles.category}>
          <Feather name="navigation" size={13} color={colors.mutedForeground} />
          <Text style={[styles.categoryText, { color: colors.mutedForeground }]}>{ride.categoryName}</Text>
        </View>
        <Text style={[styles.fare, { color: colors.primary }]}>
          R$ {fare.toFixed(2).replace(".", ",")}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { padding: 16, marginBottom: 12 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  statusBadge: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  date: { fontSize: 12, fontFamily: "Inter_400Regular" },
  route: { marginBottom: 14 },
  routeRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  line: { width: 1, height: 16, marginLeft: 3.5, marginVertical: 3 },
  address: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular" },
  footer: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  category: { flexDirection: "row", alignItems: "center", gap: 4 },
  categoryText: { fontSize: 12, fontFamily: "Inter_400Regular" },
  fare: { fontSize: 16, fontFamily: "Inter_700Bold" },
});
