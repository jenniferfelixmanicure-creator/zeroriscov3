import React, { createContext, useContext, useState, useCallback } from "react";

export type RideStatus = "idle" | "searching" | "accepted" | "arrived" | "in_progress" | "completed" | "cancelled";

export interface ActiveRide {
  id: number;
  status: RideStatus;
  categoryName: string;
  categoryIcon: string;
  originAddress: string;
  destinationAddress: string;
  estimatedFare: number;
  finalFare?: number | null;
  driverName?: string | null;
  driverPhone?: string | null;
  driverRating?: number | null;
  driverVehicle?: string | null;
  driverPlate?: string | null;
  createdAt: string;
}

interface RideContextValue {
  activeRide: ActiveRide | null;
  setActiveRide: (ride: ActiveRide | null) => void;
  clearRide: () => void;
}

const RideContext = createContext<RideContextValue>({
  activeRide: null,
  setActiveRide: () => {},
  clearRide: () => {},
});

export function RideProvider({ children }: { children: React.ReactNode }) {
  const [activeRide, setActiveRideState] = useState<ActiveRide | null>(null);

  const setActiveRide = useCallback((ride: ActiveRide | null) => {
    setActiveRideState(ride);
  }, []);

  const clearRide = useCallback(() => {
    setActiveRideState(null);
  }, []);

  return (
    <RideContext.Provider value={{ activeRide, setActiveRide, clearRide }}>
      {children}
    </RideContext.Provider>
  );
}

export function useRide() {
  return useContext(RideContext);
}
