import { LinearGradient } from "expo-linear-gradient";
import * as Location from "expo-location";
import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { AddressSearch } from "@/components/AddressSearch";
import { PremiumButton } from "@/components/PremiumButton";
import { GlowView } from "@/components/GlowView";
import { useAuth } from "@/context/AuthContext";
import { useRide } from "@/context/RideContext";
import { useColors } from "@/hooks/useColors";

interface LocationCoords {
  latitude: number;
  longitude: number;
  address?: string;
}

export default function PassengerHome() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, token } = useAuth();
  const { activeRide } = useRide();
  const pulse = useRef(new Animated.Value(1)).current;

  const [origin, setOrigin] = useState<LocationCoords | null>(null);
  const [originAddress, setOriginAddress] = useState("");
  const [destination, setDestination] = useState<LocationCoords | null>(null);
  const [destinationAddress, setDestinationAddress] = useState("");
  const [requesting, setRequesting] = useState(false);

  useEffect(() => {
    getLocation();
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.15, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);

  const getLocation = async () => {
    if (Platform.OS === "web") return;
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") return;
    const loc = await Location.getCurrentPositionAsync({});
    setOrigin({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
    const geocode = await Location.reverseGeocodeAsync(loc.coords);
    if (geocode[0]) {
      const g = geocode[0];
      const addr = `${g.street ?? ""} ${g.streetNumber ?? ""}, ${g.district ?? g.city ?? ""}`.trim();
      setOriginAddress(addr);
    }
  };

  const handleRequestRide = async () => {
    if (!origin || !destination) {
      Alert.alert("Atenção", "Informe o endereço de origem e destino.");
      return;
    }
    router.push({
      pathname: "/categories",
      params: {
        originLat: origin.latitude.toString(),
        originLng: origin.longitude.toString(),
        originAddress,
        destinationLat: destination.latitude.toString(),
        destinationLng: destination.longitude.toString(),
        destinationAddress,
      },
    });
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Background glow */}
      <LinearGradient
        colors={["rgba(0,200,255,0.05)", "transparent", "rgba(0,100,238,0.03)"]}
        style={styles.bgGlow}
        pointerEvents="none"
      />

      {/* Map placeholder area */}
      <View style={[styles.mapArea, { backgroundColor: "#060F1E" }]}>
        <View style={[styles.mapGrid]} />
        <Animated.View style={[styles.locationDot, { transform: [{ scale: pulse }] }]}>
          <View style={[styles.dotInner, { backgroundColor: colors.primary }]} />
          <View style={[styles.dotRing, { borderColor: colors.primary }]} />
        </Animated.View>
        <View style={styles.mapOverlay} pointerEvents="none">
          <LinearGradient
            colors={["transparent", colors.background]}
            style={styles.mapFade}
            pointerEvents="none"
          />
        </View>
      </View>

      <ScrollView
        style={styles.panel}
        contentContainerStyle={[styles.panelContent, { paddingBottom: insets.bottom + 80 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
          <View>
            <Text style={[styles.greeting, { color: colors.mutedForeground }]}>Olá,</Text>
            <Text style={[styles.userName, { color: colors.foreground }]}>{user?.name?.split(" ")[0]}</Text>
          </View>
          <Pressable
            onPress={() => router.push("/(passenger)/profile")}
            style={[styles.avatarBtn, { backgroundColor: colors.muted, borderColor: colors.cardBorder }]}
          >
            <Feather name="user" size={20} color={colors.primary} />
          </Pressable>
        </View>

        {/* Active ride banner */}
        {activeRide && activeRide.status !== "completed" && activeRide.status !== "cancelled" && (
          <Pressable onPress={() => router.push(`/ride/${activeRide.id}`)}>
            <GlowView style={styles.activeRideBanner} glowIntensity="medium">
              <View style={styles.activeRideRow}>
                <View style={[styles.activeRideDot, { backgroundColor: colors.success }]} />
                <Text style={[styles.activeRideText, { color: colors.foreground }]}>
                  Corrida em andamento
                </Text>
                <Feather name="chevron-right" size={16} color={colors.primary} />
              </View>
            </GlowView>
          </Pressable>
        )}

        {/* Address inputs */}
        <GlowView style={styles.addressCard} glowIntensity="low">
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Para onde vamos?</Text>
          <View style={styles.addressFields}>
            <AddressSearch
              placeholder="Origem (sua localização)"
              value={originAddress}
              icon="map-pin"
              iconColor={colors.primary}
              onSelect={(addr, lat, lng) => {
                setOriginAddress(addr);
                setOrigin({ latitude: lat, longitude: lng });
              }}
            />
            <View style={[styles.routeLine, { backgroundColor: colors.border }]} />
            <AddressSearch
              placeholder="Destino"
              value={destinationAddress}
              icon="navigation"
              iconColor={colors.destructive}
              onSelect={(addr, lat, lng) => {
                setDestinationAddress(addr);
                setDestination({ latitude: lat, longitude: lng });
              }}
            />
          </View>

          <PremiumButton
            title="Ver opções de corrida"
            onPress={handleRequestRide}
            loading={requesting}
            disabled={!origin || !destination}
            style={{ marginTop: 16 }}
          />
        </GlowView>

        {/* Quick actions */}
        <Text style={[styles.sectionTitle, { color: colors.foreground, marginTop: 8 }]}>Acesso rápido</Text>
        <View style={styles.quickActions}>
          {[
            { icon: "home" as const, label: "Casa" },
            { icon: "briefcase" as const, label: "Trabalho" },
            { icon: "star" as const, label: "Favoritos" },
            { icon: "clock" as const, label: "Recentes" },
          ].map((item) => (
            <Pressable
              key={item.label}
              style={[styles.quickBtn, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
            >
              <Feather name={item.icon} size={18} color={colors.primary} />
              <Text style={[styles.quickBtnLabel, { color: colors.foreground }]}>{item.label}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  bgGlow: { position: "absolute", inset: 0, zIndex: 0 },
  mapArea: {
    height: 260,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  mapGrid: {
    position: "absolute",
    inset: 0,
    opacity: 0.15,
  },
  mapOverlay: { position: "absolute", inset: 0, bottom: 0 },
  mapFade: { position: "absolute", bottom: 0, left: 0, right: 0, height: 100 },
  locationDot: { alignItems: "center", justifyContent: "center" },
  dotInner: { width: 14, height: 14, borderRadius: 7 },
  dotRing: {
    position: "absolute",
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    opacity: 0.4,
  },
  panel: { flex: 1, marginTop: -20 },
  panelContent: { paddingHorizontal: 20, gap: 16 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  greeting: { fontSize: 14, fontFamily: "Inter_400Regular" },
  userName: { fontSize: 22, fontFamily: "Inter_700Bold" },
  avatarBtn: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  activeRideBanner: { padding: 14 },
  activeRideRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  activeRideDot: { width: 8, height: 8, borderRadius: 4 },
  activeRideText: { flex: 1, fontSize: 14, fontFamily: "Inter_500Medium" },
  addressCard: { padding: 16 },
  sectionTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold", marginBottom: 12 },
  addressFields: { gap: 8 },
  routeLine: { width: 1, height: 12, marginLeft: 25 },
  quickActions: { flexDirection: "row", gap: 10 },
  quickBtn: {
    flex: 1,
    alignItems: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  quickBtnLabel: { fontSize: 11, fontFamily: "Inter_500Medium" },
});
