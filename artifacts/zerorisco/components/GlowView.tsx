import React from "react";
import { StyleSheet, View, ViewStyle } from "react-native";
import { useColors } from "@/hooks/useColors";

interface Props {
  children: React.ReactNode;
  style?: ViewStyle;
  glowColor?: string;
  glowIntensity?: "low" | "medium" | "high";
  noBorder?: boolean;
}

export function GlowView({ children, style, glowColor, glowIntensity = "low", noBorder = false }: Props) {
  const colors = useColors();
  const gc = glowColor ?? colors.primary;

  const intensityMap = {
    low: 0.1,
    medium: 0.25,
    high: 0.45,
  };

  const opacity = intensityMap[glowIntensity];

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.card,
          borderRadius: colors.radius,
          borderWidth: noBorder ? 0 : 1,
          borderColor: `${gc}${Math.round(opacity * 255).toString(16).padStart(2, "0")}`,
          shadowColor: gc,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: opacity * 2,
          shadowRadius: 12,
          elevation: 8,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: "hidden",
  },
});
