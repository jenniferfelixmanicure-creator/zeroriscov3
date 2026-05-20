import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";

interface Category {
  id: number;
  name: string;
  description: string;
  icon: string;
  minFare: number;
  estimatedFare?: number;
  estimatedDistance?: number;
  estimatedDuration?: number;
}

interface Props {
  category: Category;
  selected?: boolean;
  onPress: () => void;
}

const ICON_MAP: Record<string, keyof typeof Feather.glyphMap> = {
  zap: "zap",
  car: "navigation",
  star: "star",
  award: "award",
  "trending-up": "trending-up",
};

export function CategoryCard({ category, selected, onPress }: Props) {
  const colors = useColors();

  const formatPrice = (price: number) =>
    `R$ ${price.toFixed(2).replace(".", ",")}`;

  const formatTime = (minutes: number) =>
    minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)}h ${minutes % 60}min`;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]}
    >
      <View
        style={[
          styles.card,
          {
            backgroundColor: selected ? "rgba(0, 200, 255, 0.08)" : colors.card,
            borderRadius: colors.radius,
            borderWidth: 1.5,
            borderColor: selected ? colors.primary : colors.cardBorder,
          },
        ]}
      >
        {selected && (
          <View style={[styles.selectedBadge, { backgroundColor: colors.primary }]}>
            <Feather name="check" size={10} color={colors.background} />
          </View>
        )}
        <View style={styles.row}>
          <LinearGradient
            colors={selected ? ["#00C8FF", "#0055EE"] : ["#0A1F3C", "#152236"]}
            style={[styles.iconWrap, { borderRadius: 12 }]}
          >
            <Feather
              name={ICON_MAP[category.icon] ?? "navigation"}
              size={20}
              color={selected ? "#fff" : colors.primary}
            />
          </LinearGradient>
          <View style={styles.info}>
            <Text style={[styles.name, { color: colors.foreground }]}>{category.name}</Text>
            <Text style={[styles.desc, { color: colors.mutedForeground }]}>{category.description}</Text>
          </View>
          <View style={styles.priceWrap}>
            {category.estimatedFare ? (
              <Text style={[styles.price, { color: selected ? colors.primary : colors.foreground }]}>
                {formatPrice(category.estimatedFare)}
              </Text>
            ) : (
              <Text style={[styles.price, { color: colors.mutedForeground }]}>
                a partir de {formatPrice(category.minFare)}
              </Text>
            )}
            {category.estimatedDuration && (
              <Text style={[styles.time, { color: colors.mutedForeground }]}>
                {formatTime(category.estimatedDuration)}
              </Text>
            )}
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
    marginBottom: 10,
    position: "relative",
  },
  selectedBadge: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  iconWrap: { width: 48, height: 48, alignItems: "center", justifyContent: "center" },
  info: { flex: 1 },
  name: { fontSize: 15, fontFamily: "Inter_600SemiBold", marginBottom: 2 },
  desc: { fontSize: 12, fontFamily: "Inter_400Regular" },
  priceWrap: { alignItems: "flex-end" },
  price: { fontSize: 15, fontFamily: "Inter_700Bold" },
  time: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
});
