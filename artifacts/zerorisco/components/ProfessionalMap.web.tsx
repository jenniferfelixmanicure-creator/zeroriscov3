import React, { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';

interface Coordinate {
  latitude: number;
  longitude: number;
}

interface ProfessionalMapProps {
  origin?: Coordinate;
  destination?: Coordinate;
  driverLocation?: Coordinate;
  routeCoordinates?: Coordinate[];
  onRegionChange?: (region: any) => void;
}

const MAPLIBRE_CSS = 'https://unpkg.com/maplibre-gl@11/dist/maplibre-gl.css';

function injectMapLibreCSS() {
  if (document.querySelector(`link[href="${MAPLIBRE_CSS}"]`)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = MAPLIBRE_CSS;
  document.head.appendChild(link);
}

const DARK_STYLE = {
  version: 8 as const,
  sources: {
    carto: {
      type: 'raster' as const,
      tiles: [
        'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
        'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
        'https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
      ],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors © CARTO',
    },
  },
  layers: [
    {
      id: 'carto-dark',
      type: 'raster' as const,
      source: 'carto',
      minzoom: 0,
      maxzoom: 20,
    },
  ],
  glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
};

const ProfessionalMap: React.FC<ProfessionalMapProps> = ({
  origin,
  destination,
  driverLocation,
  routeCoordinates,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);

  const centerLng = origin?.longitude ?? -46.6333;
  const centerLat = origin?.latitude ?? -23.5505;

  useEffect(() => {
    injectMapLibreCSS();

    let map: any;

    import('maplibre-gl').then((mod) => {
      const maplibregl = mod.default ?? mod;
      if (!containerRef.current || mapRef.current) return;

      map = new maplibregl.Map({
        container: containerRef.current,
        style: DARK_STYLE,
        center: [centerLng, centerLat],
        zoom: 13,
        attributionControl: false,
      });

      map.addControl(
        new maplibregl.AttributionControl({ compact: true }),
        'bottom-right'
      );

      mapRef.current = map;
    });

    return () => {
      if (map) {
        map.remove();
        mapRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    import('maplibre-gl').then((mod) => {
      const maplibregl = mod.default ?? mod;

      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];

      if (origin) {
        const el = document.createElement('div');
        el.style.cssText =
          'width:14px;height:14px;border-radius:50%;background:#00C8FF;border:2px solid #060D1A;box-shadow:0 0 10px #00C8FFaa';
        markersRef.current.push(
          new maplibregl.Marker({ element: el })
            .setLngLat([origin.longitude, origin.latitude])
            .addTo(map)
        );
      }

      if (destination) {
        const el = document.createElement('div');
        el.style.cssText =
          'width:14px;height:14px;border-radius:50%;background:#FF3A6E;border:2px solid #060D1A;box-shadow:0 0 10px #FF3A6Eaa';
        markersRef.current.push(
          new maplibregl.Marker({ element: el })
            .setLngLat([destination.longitude, destination.latitude])
            .addTo(map)
        );
      }

      if (driverLocation) {
        const el = document.createElement('div');
        el.style.cssText =
          'width:16px;height:16px;border-radius:50%;background:#FFB800;border:2px solid #060D1A;box-shadow:0 0 10px #FFB800aa';
        markersRef.current.push(
          new maplibregl.Marker({ element: el })
            .setLngLat([driverLocation.longitude, driverLocation.latitude])
            .addTo(map)
        );
      }

      const points = [origin, destination, driverLocation].filter(Boolean) as Coordinate[];
      const lngs = points.map((p) => p.longitude);
      const lats = points.map((p) => p.latitude);

      if (points.length === 1) {
        map.flyTo({ center: [lngs[0], lats[0]], zoom: 14, duration: 600 });
      } else if (points.length > 1) {
        map.fitBounds(
          [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
          { padding: 60, duration: 600 }
        );
      }

      const sourceId = 'route';
      const layerId = 'route-line';

      const tryRemove = () => {
        if (map.getLayer(layerId)) map.removeLayer(layerId);
        if (map.getSource(sourceId)) map.removeSource(sourceId);
      };

      if (map.loaded()) {
        tryRemove();
        addRoute();
      } else {
        map.once('load', () => {
          tryRemove();
          addRoute();
        });
      }

      function addRoute() {
        if (!routeCoordinates || routeCoordinates.length < 2) return;
        const coords: [number, number][] = routeCoordinates.map((c) => [c.longitude, c.latitude]);
        map.addSource(sourceId, {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {},
            geometry: { type: 'LineString', coordinates: coords },
          },
        });
        map.addLayer({
          id: layerId,
          type: 'line',
          source: sourceId,
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: { 'line-color': '#00C8FF', 'line-width': 4, 'line-opacity': 0.9 },
        });
      }
    });
  }, [origin, destination, driverLocation, routeCoordinates]);

  return (
    <View style={styles.container}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
  },
});

export default ProfessionalMap;
