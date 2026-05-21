import React, { useEffect, useRef } from 'react';
import { StyleSheet, View, Platform } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE, UrlTile } from 'react-native-maps';
import * as Location from 'expo-location';

interface Coordinate {
  latitude: number;
  longitude: number;
}

interface ProfessionalMapProps {
  origin?: Coordinate;
  destination?: Coordinate;
  driverLocation?: Coordinate;
  userLocation?: Coordinate;
  routeCoordinates?: Coordinate[];
  onRegionChange?: (region: any) => void;
}

const ProfessionalMap: React.FC<ProfessionalMapProps> = ({
  origin,
  destination,
  driverLocation,
  routeCoordinates,
  onRegionChange,
}) => {
  const mapRef = useRef<MapView>(null);

  useEffect(() => {
    if (mapRef.current && (origin || destination || driverLocation)) {
      const coords = [origin, destination, driverLocation].filter(Boolean) as Coordinate[];
      if (coords.length > 0) {
        mapRef.current.fitToCoordinates(coords, {
          edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
          animated: true,
        });
      }
    }
  }, [origin, destination, driverLocation]);

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={{
          latitude: origin?.latitude || -23.5505,
          longitude: origin?.longitude || -46.6333,
          latitudeDelta: 0.0922,
          longitudeDelta: 0.0421,
        }}
        onRegionChangeComplete={onRegionChange}
        showsUserLocation
        showsMyLocationButton={false}
        customMapStyle={darkMapStyle}
      >
        {/* Usando OpenStreetMap Tiles para evitar custos de API do Google */}
        <UrlTile
          urlTemplate="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maximumZ={19}
          flipY={false}
        />

        {origin && (
          <Marker
            coordinate={origin}
            title="Origem"
            pinColor="#00C8FF"
          />
        )}

        {destination && (
          <Marker
            coordinate={destination}
            title="Destino"
            pinColor="#FF3A6E"
          />
        )}

        {driverLocation && (
          <Marker
            coordinate={driverLocation}
            title="Motorista"
            image={require('../assets/images/icon.png')} // Idealmente um ícone de carro
          />
        )}

        {routeCoordinates && routeCoordinates.length > 0 && (
          <Polyline
            coordinates={routeCoordinates}
            strokeColor="#00C8FF"
            strokeWidth={4}
          />
        )}
      </MapView>
    </View>
  );
};

const darkMapStyle = [
  {
    "elementType": "geometry",
    "stylers": [{ "color": "#060D1A" }]
  },
  {
    "elementType": "labels.text.fill",
    "stylers": [{ "color": "#4E7090" }]
  },
  {
    "elementType": "labels.text.stroke",
    "stylers": [{ "color": "#060D1A" }]
  },
  {
    "featureType": "road",
    "elementType": "geometry",
    "stylers": [{ "color": "#1A3050" }]
  },
  {
    "featureType": "water",
    "elementType": "geometry",
    "stylers": [{ "color": "#0A1628" }]
  }
];

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
});

export default ProfessionalMap;
