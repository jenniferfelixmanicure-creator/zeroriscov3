import React, { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import MapView, { Marker, Polyline, UrlTile } from 'react-native-maps';

const driverIcon = require('../assets/images/icon.png');

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
      >
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
            image={driverIcon}
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
