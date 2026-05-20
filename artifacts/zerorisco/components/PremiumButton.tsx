import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  ViewStyle,
} from "react-native";
import { useColors } from "@/hooks/useColors";

interface Props {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  size?: "sm" | "md" | "lg";
}

export function PremiumButton({
  title,
  onPress,
  variant = "primary",
  loading = false,
  disabled = false,
  style,
  size = "md",
}: Props) {
  const colors = useColors();

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  const heights = { sm: 40, md: 52, lg: 60 };
  const fontSizes = { sm: 13, md: 15, lg: 17 };

  if (variant === "primary") {
    return (
      <Pressable
        onPress={handlePress}
        disabled={disabled || loading}
        style={({ pressed }) => [
          { opacity: pressed || disabled ? 0.7 : 1, borderRadius: colors.radius },
          style,
        ]}
      >
        <LinearGradient
          colors={["#00C8FF", "#0066EE"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.base, { height: heights[size], borderRadius: colors.radius }]}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={[styles.primaryText, { fontSize: fontSizes[size] }]}>{title}</Text>
          )}
        </LinearGradient>
      </Pressable>
    );
  }

  if (variant === "secondary") {
    return (
      <Pressable
        onPress={handlePress}
        disabled={disabled || loading}
        style={({ pressed }) => [
          styles.base,
          {
            height: heights[size],
            borderRadius: colors.radius,
            backgroundColor: colors.secondary,
            borderWidth: 1,
            borderColor: colors.cardBorder,
            opacity: pressed || disabled ? 0.7 : 1,
          },
          style,
        ]}
      >
        {loading ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <Text style={[styles.secondaryText, { fontSize: fontSizes[size], color: colors.primary }]}>{title}</Text>
        )}
      </Pressable>
    );
  }

  if (variant === "danger") {
    return (
      <Pressable
        onPress={handlePress}
        disabled={disabled || loading}
        style={({ pressed }) => [
          styles.base,
          {
            height: heights[size],
            borderRadius: colors.radius,
            backgroundColor: "rgba(255, 58, 110, 0.15)",
            borderWidth: 1,
            borderColor: "rgba(255, 58, 110, 0.3)",
            opacity: pressed || disabled ? 0.7 : 1,
          },
          style,
        ]}
      >
        <Text style={[styles.secondaryText, { fontSize: fontSizes[size], color: colors.destructive }]}>{title}</Text>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        {
          height: heights[size],
          borderRadius: colors.radius,
          opacity: pressed || disabled ? 0.5 : 1,
        },
        style,
      ]}
    >
      <Text style={[styles.secondaryText, { fontSize: fontSizes[size], color: colors.mutedForeground }]}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 20,
  },
  primaryText: {
    color: "#fff",
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.3,
  },
  secondaryText: {
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.3,
  },
});
