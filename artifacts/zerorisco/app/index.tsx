import { Redirect } from "expo-router";
  import { ActivityIndicator, View } from "react-native";
  import { useAuth } from "@/context/AuthContext";
  import { useColors } from "@/hooks/useColors";

  export default function Root() {
    const { user, isLoading } = useAuth();
    const colors = useColors();

    if (isLoading) {
      return (
        <View style={{ flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      );
    }

    if (!user) {
      return <Redirect href="/(auth)/login" />;
    }

    if (user.role === "admin") {
      return <Redirect href="/(tabs)" />;
    }

    if (user.role === "driver") {
      if (user.approvalStatus && user.approvalStatus !== "approved") {
        return <Redirect href="/(driver)/pending" />;
      }
      return <Redirect href="/(driver)" />;
    }

    return <Redirect href="/(passenger)" />;
  }