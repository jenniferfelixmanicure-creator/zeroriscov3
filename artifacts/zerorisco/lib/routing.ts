interface Coordinate {
  latitude: number;
  longitude: number;
}

interface RouteInfo {
  coordinates: Coordinate[];
  distance: number; // metros
  duration: number; // segundos
}

/**
 * Busca rota usando OpenRouteService (ORS)
 * Documentação: https://openrouteservice.org/dev/#/api-endpoints/v2/directions/{profile}/get
 */
export const getRoute = async (origin: Coordinate, destination: Coordinate): Promise<RouteInfo | null> => {
  try {
    // Nota: Para produção, você deve obter uma API Key gratuita em openrouteservice.org
    // e configurar como EXPO_PUBLIC_ORS_API_KEY no seu .env
    const apiKey = process.env.EXPO_PUBLIC_ORS_API_KEY;
    
    // Usando o endpoint público do ORS (pode ter limites, ideal usar sua chave)
    const url = `https://api.openrouteservice.org/v2/directions/driving-car?api_key=${apiKey}&start=${origin.longitude},${origin.latitude}&end=${destination.longitude},${destination.latitude}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      console.error('Erro na resposta do ORS:', await response.text());
      return null;
    }

    const data = await response.json();

    if (!data.features || data.features.length === 0) {
      return null;
    }

    const route = data.features[0];
    const coordinates = route.geometry.coordinates.map((coord: [number, number]) => ({
      latitude: coord[1],
      longitude: coord[0],
    }));

    const summary = route.properties.summary;

    return {
      coordinates,
      distance: summary.distance,
      duration: summary.duration,
    };
  } catch (error) {
    console.error('Erro ao buscar rota no OpenRouteService:', error);
    return null;
  }
};
