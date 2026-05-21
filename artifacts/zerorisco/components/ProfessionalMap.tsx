import React, { useEffect, useRef } from 'react';
import { StyleSheet, View, Platform } from 'react-native';
import { WebView } from 'react-native-webview';

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
  userLocation,
  routeCoordinates,
}) => {
  const webViewRef = useRef<WebView>(null);

  const mapHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="initial-scale=1,maximum-scale=1,user-scalable=no" />
      <script src="https://unpkg.com/maplibre-gl@2.4.0/dist/maplibre-gl.js"></script>
      <link href="https://unpkg.com/maplibre-gl@2.4.0/dist/maplibre-gl.css" rel="stylesheet" />
      <style>
        body { margin: 0; padding: 0; }
        #map { position: absolute; top: 0; bottom: 0; width: 100%; background: #060D1A; }
        .marker-origin { width: 20px; height: 20px; background: #00C8FF; border: 3px solid #fff; border-radius: 50%; box-shadow: 0 0 10px #00C8FF; }
        .marker-dest { width: 20px; height: 20px; background: #FF3A6E; border: 3px solid #fff; border-radius: 50%; box-shadow: 0 0 10px #FF3A6E; }
        .marker-driver { font-size: 30px; }
      </style>
    </head>
    <body>
      <div id="map"></div>
      <script>
        const map = new maplibregl.Map({
          container: 'map',
          style: {
            version: 8,
            sources: {
              'osm': {
                type: 'raster',
                tiles: ['https://a.tile.openstreetmap.org/{z}/{x}/{y}.png'],
                tileSize: 256,
                attribution: '&copy; OpenStreetMap contributors'
              }
            },
            layers: [{
              id: 'osm',
              type: 'raster',
              source: 'osm',
              minzoom: 0,
              maxzoom: 19
            }]
          },
          center: [${origin?.longitude || -46.6333}, ${origin?.latitude || -23.5505}],
          zoom: 13
        });

        let originMarker, destMarker, driverMarker;

        window.updateMarkers = (data) => {
          const { origin, destination, driverLocation, route } = data;
          
          if (origin) {
            if (!originMarker) {
              const el = document.createElement('div'); el.className = 'marker-origin';
              originMarker = new maplibregl.Marker(el).setLngLat([origin.longitude, origin.latitude]).addTo(map);
            } else {
              originMarker.setLngLat([origin.longitude, origin.latitude]);
            }
          }

          if (destination) {
            if (!destMarker) {
              const el = document.createElement('div'); el.className = 'marker-dest';
              destMarker = new maplibregl.Marker(el).setLngLat([destination.longitude, destination.latitude]).addTo(map);
            } else {
              destMarker.setLngLat([destination.longitude, destination.latitude]);
            }
          }

          if (driverLocation) {
            if (!driverMarker) {
              const el = document.createElement('div'); el.className = 'marker-driver'; el.innerHTML = '🚗';
              driverMarker = new maplibregl.Marker(el).setLngLat([driverLocation.longitude, driverLocation.latitude]).addTo(map);
            } else {
              driverMarker.setLngLat([driverLocation.longitude, driverLocation.latitude]);
            }
          }

          if (route && route.length > 1) {
            const geojson = {
              type: 'Feature',
              geometry: {
                type: 'LineString',
                coordinates: route.map(c => [c.longitude, c.latitude])
              }
            };
            if (map.getSource('route')) {
              map.getSource('route').setData(geojson);
            } else {
              map.addSource('route', { type: 'geojson', data: geojson });
              map.addLayer({
                id: 'route',
                type: 'line',
                source: 'route',
                layout: { 'line-join': 'round', 'line-cap': 'round' },
                paint: { 'line-color': '#00C8FF', 'line-width': 5 }
              });
            }
          }

          // Fit bounds
          const points = [origin, destination, driverLocation].filter(Boolean);
          if (points.length > 1) {
            const bounds = new maplibregl.LngLatBounds();
            points.forEach(p => bounds.extend([p.longitude, p.latitude]));
            map.fitBounds(bounds, { padding: 50 });
          }
        };
      </script>
    </body>
    </html>
  `;

  useEffect(() => {
    if (webViewRef.current) {
      const data = JSON.stringify({ origin, destination, driverLocation, route: routeCoordinates });
      webViewRef.current.injectJavaScript(`window.updateMarkers(${data}); true;`);
    }
  }, [origin, destination, driverLocation, routeCoordinates]);

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        originWhitelist={['*']}
        source={{ html: mapHtml }}
        style={styles.map}
        backgroundColor="#060D1A"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
});

export default ProfessionalMap;
