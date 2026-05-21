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
  userLocation?: Coordinate;
  routeCoordinates?: Coordinate[];
  onRegionChange?: (region: any) => void;
}

const MAPLIBRE_CSS = 'https://unpkg.com/maplibre-gl@11/dist/maplibre-gl.css';

function injectStyles() {
  if (document.getElementById('zerорisco-map-styles')) return;
  const style = document.createElement('style');
  style.id = 'zerорisco-map-styles';
  style.textContent = `
    @keyframes zr-pulse {
      0%   { transform: scale(1); opacity: 0.8; }
      70%  { transform: scale(3.5); opacity: 0; }
      100% { transform: scale(1); opacity: 0; }
    }
    @keyframes zr-pulse-inner {
      0%, 100% { box-shadow: 0 0 0 0 rgba(74,144,226,0.6); }
      50%       { box-shadow: 0 0 0 8px rgba(74,144,226,0); }
    }
    .zr-user-dot {
      width: 22px; height: 22px;
      display: flex; align-items: center; justify-content: center;
      position: relative;
    }
    .zr-user-dot::before {
      content: '';
      position: absolute;
      width: 22px; height: 22px;
      border-radius: 50%;
      background: rgba(74, 144, 226, 0.45);
      animation: zr-pulse 2.2s ease-out infinite;
    }
    .zr-user-dot-inner {
      width: 14px; height: 14px;
      border-radius: 50%;
      background: #4A90E2;
      border: 2.5px solid #fff;
      box-shadow: 0 0 8px rgba(74,144,226,0.8);
      z-index: 1;
      position: relative;
      animation: zr-pulse-inner 2s ease-in-out infinite;
    }
    .zr-car {
      width: 36px; height: 36px;
      background: #fff;
      border-radius: 50%;
      border: 2px solid #060D1A;
      display: flex; align-items: center; justify-content: center;
      font-size: 18px;
      box-shadow: 0 2px 12px rgba(0,200,255,0.5);
      transition: transform 0.3s ease;
      cursor: pointer;
    }
    .zr-origin-dot {
      width: 16px; height: 16px;
      border-radius: 50%;
      background: #00C8FF;
      border: 2.5px solid #060D1A;
      box-shadow: 0 0 12px rgba(0,200,255,0.7);
    }
    .zr-dest-dot {
      width: 16px; height: 16px;
      border-radius: 50%;
      background: #FF3A6E;
      border: 2.5px solid #060D1A;
      box-shadow: 0 0 12px rgba(255,58,110,0.7);
    }
    .maplibregl-ctrl-attrib { font-size: 10px !important; }
  `;
  document.head.appendChild(style);

  if (!document.querySelector(`link[href="${MAPLIBRE_CSS}"]`)) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = MAPLIBRE_CSS;
    document.head.appendChild(link);
  }
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
  layers: [{ id: 'carto-dark', type: 'raster' as const, source: 'carto' }],
  glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
};

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

const ProfessionalMap: React.FC<ProfessionalMapProps> = ({
  origin,
  destination,
  driverLocation,
  userLocation,
  routeCoordinates,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<Record<string, any>>({});
  const driverAnimRef = useRef<{ from: [number,number]; to: [number,number]; start: number; rafId: number } | null>(null);
  const driverPosRef = useRef<[number, number] | null>(null);

  const centerLng = origin?.longitude ?? userLocation?.longitude ?? -46.6333;
  const centerLat = origin?.latitude ?? userLocation?.latitude ?? -23.5505;

  // Init map once
  useEffect(() => {
    injectStyles();
    let map: any;

    import('maplibre-gl').then((mod) => {
      const maplibregl = mod.default ?? mod;
      if (!containerRef.current || mapRef.current) return;

      map = new maplibregl.Map({
        container: containerRef.current,
        style: DARK_STYLE,
        center: [centerLng, centerLat],
        zoom: 14,
        attributionControl: false,
        pitchWithRotate: false,
        dragRotate: false,
      });

      map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');
      mapRef.current = map;
    });

    return () => {
      if (driverAnimRef.current) cancelAnimationFrame(driverAnimRef.current.rafId);
      if (map) { map.remove(); mapRef.current = null; }
    };
  }, []);

  // Helper: get or create marker
  const getMarker = async (key: string, createEl: () => HTMLElement) => {
    const mod = await import('maplibre-gl');
    const maplibregl = mod.default ?? mod;
    const map = mapRef.current;
    if (!map) return null;
    if (!markersRef.current[key]) {
      markersRef.current[key] = new maplibregl.Marker({ element: createEl(), anchor: 'center' })
        .setLngLat([0, 0])
        .addTo(map);
    }
    return markersRef.current[key];
  };

  const removeMarker = (key: string) => {
    if (markersRef.current[key]) {
      markersRef.current[key].remove();
      delete markersRef.current[key];
    }
  };

  // User location: pulsing blue dot
  useEffect(() => {
    if (!userLocation) { removeMarker('user'); return; }
    getMarker('user', () => {
      const wrap = document.createElement('div');
      wrap.className = 'zr-user-dot';
      const inner = document.createElement('div');
      inner.className = 'zr-user-dot-inner';
      wrap.appendChild(inner);
      return wrap;
    }).then((m) => {
      if (m) m.setLngLat([userLocation.longitude, userLocation.latitude]);
    });
  }, [userLocation?.latitude, userLocation?.longitude]);

  // Origin marker
  useEffect(() => {
    if (!origin) { removeMarker('origin'); return; }
    getMarker('origin', () => {
      const el = document.createElement('div');
      el.className = 'zr-origin-dot';
      return el;
    }).then((m) => {
      if (m) m.setLngLat([origin.longitude, origin.latitude]);
    });
  }, [origin?.latitude, origin?.longitude]);

  // Destination marker
  useEffect(() => {
    if (!destination) { removeMarker('dest'); return; }
    getMarker('dest', () => {
      const el = document.createElement('div');
      el.className = 'zr-dest-dot';
      return el;
    }).then((m) => {
      if (m) m.setLngLat([destination.longitude, destination.latitude]);
    });
  }, [destination?.latitude, destination?.longitude]);

  // Driver location: smooth animated car marker
  useEffect(() => {
    if (!driverLocation) { removeMarker('driver'); return; }
    const newTarget: [number, number] = [driverLocation.longitude, driverLocation.latitude];

    getMarker('driver', () => {
      const el = document.createElement('div');
      el.className = 'zr-car';
      el.innerHTML = '🚗';
      return el;
    }).then((marker) => {
      if (!marker) return;

      if (driverAnimRef.current) {
        cancelAnimationFrame(driverAnimRef.current.rafId);
        driverAnimRef.current = null;
      }

      const from = driverPosRef.current ?? newTarget;
      const duration = 1200;

      const animate = (timestamp: number) => {
        if (!driverAnimRef.current) return;
        const elapsed = timestamp - driverAnimRef.current.start;
        const t = Math.min(elapsed / duration, 1);
        const eased = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

        const lng = lerp(driverAnimRef.current.from[0], driverAnimRef.current.to[0], eased);
        const lat = lerp(driverAnimRef.current.from[1], driverAnimRef.current.to[1], eased);
        marker.setLngLat([lng, lat]);
        driverPosRef.current = [lng, lat];

        // Rotate car icon toward movement direction
        const dLng = driverAnimRef.current.to[0] - driverAnimRef.current.from[0];
        const dLat = driverAnimRef.current.to[1] - driverAnimRef.current.from[1];
        if (Math.abs(dLng) > 0.00001 || Math.abs(dLat) > 0.00001) {
          const angle = Math.atan2(dLng, dLat) * (180 / Math.PI);
          const el = marker.getElement();
          if (el) el.style.transform = `rotate(${angle}deg)`;
        }

        if (t < 1) {
          driverAnimRef.current.rafId = requestAnimationFrame(animate);
        } else {
          driverAnimRef.current = null;
        }
      };

      driverAnimRef.current = { from, to: newTarget, start: 0, rafId: 0 };
      driverAnimRef.current.rafId = requestAnimationFrame((ts) => {
        if (driverAnimRef.current) {
          driverAnimRef.current.start = ts;
          animate(ts);
        }
      });
    });
  }, [driverLocation?.latitude, driverLocation?.longitude]);

  // Route polyline
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const addRoute = () => {
      if (map.getLayer('route-line')) map.removeLayer('route-line');
      if (map.getLayer('route-line-bg')) map.removeLayer('route-line-bg');
      if (map.getSource('route')) map.removeSource('route');
      if (!routeCoordinates || routeCoordinates.length < 2) return;

      const coords: [number, number][] = routeCoordinates.map((c) => [c.longitude, c.latitude]);
      map.addSource('route', {
        type: 'geojson',
        data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coords } },
      });
      // Shadow line
      map.addLayer({
        id: 'route-line-bg',
        type: 'line', source: 'route',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#00C8FF', 'line-width': 8, 'line-opacity': 0.15 },
      });
      // Main line
      map.addLayer({
        id: 'route-line',
        type: 'line', source: 'route',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#00C8FF', 'line-width': 4, 'line-opacity': 0.95 },
      });
    };

    if (map.loaded()) addRoute();
    else map.once('load', addRoute);
  }, [routeCoordinates]);

  // Auto-fit camera to visible points
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const points = [origin, destination, driverLocation, userLocation].filter(Boolean) as Coordinate[];
    if (points.length === 0) return;

    const lngs = points.map((p) => p.longitude);
    const lats = points.map((p) => p.latitude);

    const doFit = () => {
      if (points.length === 1) {
        map.flyTo({ center: [lngs[0], lats[0]], zoom: 15, duration: 800 });
      } else {
        map.fitBounds(
          [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
          { padding: { top: 80, bottom: 200, left: 60, right: 60 }, duration: 800, maxZoom: 17 }
        );
      }
    };

    if (map.loaded()) doFit();
    else map.once('load', doFit);
  }, [
    origin?.latitude, origin?.longitude,
    destination?.latitude, destination?.longitude,
    driverLocation?.latitude, driverLocation?.longitude,
  ]);

  return (
    <View style={styles.container}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { ...StyleSheet.absoluteFillObject },
});

export default ProfessionalMap;
