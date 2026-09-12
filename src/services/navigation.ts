import { apiGet } from "./api";

export type NavigationPlace = { name: string; latitude: number; longitude: number };
export type NavigationStep = { instruction: string; distance: string; duration: string };
export type NavigationRoute = { id: string; distance: string; duration: string; normalDuration: string; startAddress: string; endAddress: string; summary: string; polyline: string; steps: NavigationStep[] };
export type NavigationRouteResult = { routes: NavigationRoute[] };
export type NearbyPlace = NavigationPlace & { address: string; category: string; distance: number; rating?: number; ratingCount?: number; openNow?: boolean; priceLevel?: string; googleMapsUri?: string };

export function searchLocations(query: string) {
  return apiGet<NavigationPlace[]>(`/navigation/search?q=${encodeURIComponent(query)}`);
}

export function getRoute(latitude: number, longitude: number) {
  return apiGet<NavigationRouteResult>(`/navigation/route?latitude=${latitude}&longitude=${longitude}`);
}

export function discoverNearby(query: string) { return apiGet<NearbyPlace[]>(`/navigation/discover?q=${encodeURIComponent(query)}`); }
export function discoverAtDestination(query: string, latitude: number, longitude: number) { return apiGet<NearbyPlace[]>(`/travel/recommendations?q=${encodeURIComponent(query)}&latitude=${latitude}&longitude=${longitude}`); }
export function getMapConfig() { return apiGet<{ mapsApiKey: string }>("/navigation/map-config"); }
