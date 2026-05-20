import React, { useState, useCallback, useRef } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  Keyboard,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";

interface Suggestion {
  id: string;
  name: string;
  display_name: string;
  lat: number;
  lon: number;
}

interface Props {
  placeholder: string;
  value: string;
  onSelect: (address: string, lat: number, lng: number) => void;
  icon?: keyof typeof Feather.glyphMap;
  iconColor?: string;
}

export function AddressSearch({ placeholder, value, onSelect, icon = "map-pin", iconColor }: Props) {
  const colors = useColors();
  const [query, setQuery] = useState(value);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);
  const searchTimeout = useRef<NodeJS.Timeout>();

  const search = useCallback((text: string) => {
    setQuery(text);
    if (text.length < 3) {
      setSuggestions([]);
      return;
    }

    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }

    setLoading(true);
    searchTimeout.current = setTimeout(async () => {
      try {
        // Usando Photon (mais rápido e inteligente que Nominatim direto)
        const res = await fetch(
          `https://photon.komoot.io/api/?q=${encodeURIComponent(text)}&limit=5&lang=pt`
        );
        const data = await res.json();
        
        const mapped: Suggestion[] = data.features.map((f: any, index: number) => {
          const props = f.properties;
          const name = props.name || props.street || "";
          const city = props.city || props.state || "";
          const display = [name, props.district, city].filter(Boolean).join(", ");
          
          return {
            id: `${index}-${props.osm_id}`,
            name: name,
            display_name: display,
            lat: f.geometry.coordinates[1],
            lon: f.geometry.coordinates[0],
          };
        });

        setSuggestions(mapped);
      } catch (err) {
        console.error("Erro na busca Photon:", err);
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 500);
  }, []);

  const handleSelect = (item: Suggestion) => {
    setQuery(item.name);
    setSuggestions([]);
    setFocused(false);
    Keyboard.dismiss();
    onSelect(item.display_name, item.lat, item.lon);
  };

  return (
    <View style={styles.wrapper}>
      <View
        style={[
          styles.inputRow,
          {
            backgroundColor: colors.muted,
            borderRadius: colors.radius,
            borderWidth: 1,
            borderColor: focused ? colors.primary : colors.cardBorder,
          },
        ]}
      >
        <Feather name={icon} size={18} color={iconColor ?? colors.primary} style={styles.icon} />
        <TextInput
          value={query}
          onChangeText={search}
          placeholder={placeholder}
          placeholderTextColor={colors.mutedForeground}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 200)}
          style={[styles.input, { color: colors.foreground, fontFamily: "Inter_400Regular" }]}
        />
        {loading && <ActivityIndicator size="small" color={colors.primary} style={{ marginRight: 12 }} />}
        {query.length > 0 && !loading && (
          <Pressable onPress={() => { setQuery(""); setSuggestions([]); }} style={{ marginRight: 12 }}>
            <Feather name="x" size={16} color={colors.mutedForeground} />
          </Pressable>
        )}
      </View>
      {focused && suggestions.length > 0 && (
        <View
          style={[
            styles.dropdown,
            {
              backgroundColor: colors.card,
              borderColor: colors.cardBorder,
              borderRadius: colors.radius,
            },
          ]}
        >
          <FlatList
            data={suggestions}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
            renderItem={({ item, index }) => (
              <Pressable
                onPress={() => handleSelect(item)}
                style={[
                  styles.suggestionItem,
                  index < suggestions.length - 1 && {
                    borderBottomWidth: 1,
                    borderBottomColor: colors.border,
                  },
                ]}
              >
                <Feather name="map-pin" size={14} color={colors.mutedForeground} style={{ marginRight: 10 }} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.suggestionName, { color: colors.foreground }]} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={[styles.suggestionText, { color: colors.mutedForeground }]} numberOfLines={1}>
                    {item.display_name}
                  </Text>
                </View>
              </Pressable>
            )}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { position: "relative", zIndex: 10 },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    height: 52,
    paddingHorizontal: 14,
  },
  icon: { marginRight: 10 },
  input: { flex: 1, fontSize: 15 },
  dropdown: {
    position: "absolute",
    top: 56,
    left: 0,
    right: 0,
    borderWidth: 1,
    zIndex: 100,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  suggestionItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  suggestionName: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  suggestionText: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
});
