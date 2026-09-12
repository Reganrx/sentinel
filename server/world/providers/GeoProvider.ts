export interface LocationInfo {

  latitude: number;

  longitude: number;

  city?: string;

  county?: string;

  country?: string;

  postcode?: string;

}

export interface NearbyPlace {

  name: string;

  latitude: number;

  longitude: number;

}

export interface DirectionsResult {

  distance: string;

  duration: string;

}

export interface GeoProvider {

  reverseGeocode(
    latitude: number,
    longitude: number
  ): Promise<LocationInfo>;

  nearbyPlaces(): Promise<NearbyPlace[]>;

  directions(): Promise<DirectionsResult>;

}