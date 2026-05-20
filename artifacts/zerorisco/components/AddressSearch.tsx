import React, { useState, useCallback } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";

interface Suggestion {
  place_id: string;
  display_name: string;
  lat: string;
  lon: string;
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

  const search = useCallback(async (text: string) => {
    setQuery(text);
    if (text.length < 3) {
      setSuggestions([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(text)}&format=json&limit=5&countrycodes=br`,
        { headers: { "Accept-Language": "pt-BR" } }
      );
      const data: Suggestion[] = await res.json();
      setSuggestions(data);
    } catch {
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSelect = (item: Suggestion) => {
    const shortName = item.display_name.split(",").slice(0, 3).join(",").trim();
    setQuery(shortName);
    setSuggestions([]);
    setFocused(false);
    onSelect(shortName, parseFloat(item.lat), parseFloat(item.lon));
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
            keyExtractor={(item) => item.place_id}
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
                <Text style={[styles.suggestionText, { color: colors.foreground }]} numberOfLines={2}>
                  {item.display_name.split(",").slice(0, 3).join(",")}
                </Text>
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
  suggestionText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular" },
});
