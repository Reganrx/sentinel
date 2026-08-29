import { FormEvent, useEffect, useRef, useState } from "react";
import {
  Clock3,
  Crosshair,
  List,
  MapPinned,
  Navigation,
  Route,
  Search,
  Star,
  TrafficCone,
  X,
} from "lucide-react";
import { useWorldContext } from "../../world/WorldContext";
import {
  discoverNearby,
  getMapConfig,
  getRoute,
  searchLocations,
  type NavigationPlace,
  type NavigationRoute,
  type NearbyPlace,
} from "../../services/navigation";
import { updateLocation } from "../../services/location";
import "./NavigationView.css";

declare global {
  interface Window {
    google?: any;
    sentinelGoogleMaps?: Promise<void>;
    sentinelGoogleMapsReady?: () => void;
  }
}

const mapStyle = [
  { elementType: "geometry", stylers: [{ color: "#0b1726" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#9bb4c9" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#07111d" }] },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: "#1c3c55" }],
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#071a2c" }],
  },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
];
async function loadGoogleMaps() {
  if (window.google?.maps) return;
  if (!window.sentinelGoogleMaps)
    window.sentinelGoogleMaps = getMapConfig().then(
      ({ mapsApiKey }) =>
        new Promise<void>((resolve, reject) => {
          const script = document.createElement("script");
          window.sentinelGoogleMapsReady = () => {
            delete window.sentinelGoogleMapsReady;
            resolve();
          };
          script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(mapsApiKey)}&libraries=geometry,marker&v=weekly&loading=async&callback=sentinelGoogleMapsReady`;
          script.async = true;
          script.onerror = () => {
            delete window.sentinelGoogleMapsReady;
            reject(new Error("Google Maps could not be loaded."));
          };
          document.head.appendChild(script);
        }),
    );
  return window.sentinelGoogleMaps;
}

function LiveMap({
  latitude,
  longitude,
  route,
  traffic,
  recenterVersion,
}: {
  latitude?: number;
  longitude?: number;
  route: NavigationRoute | null;
  traffic: boolean;
  recenterVersion: number;
}) {
  const elementRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>();
  const originRef = useRef<any>();
  const destinationRef = useRef<any>();
  const routeRef = useRef<any>();
  const trafficRef = useRef<any>();
  const [mapError, setMapError] = useState("");
  const [mapReady, setMapReady] = useState(false);
  const hasLocation = Number.isFinite(latitude) && Number.isFinite(longitude);
  useEffect(() => {
    let cancelled = false;
    void loadGoogleMaps()
      .then(() => {
        if (cancelled || !elementRef.current || mapRef.current) return;
        mapRef.current = new window.google.maps.Map(elementRef.current, {
          center: hasLocation
            ? { lat: latitude, lng: longitude }
            : { lat: 51.628, lng: -0.75 },
          zoom: hasLocation ? 14 : 9,
          styles: mapStyle,
          disableDefaultUI: true,
          zoomControl: true,
          zoomControlOptions: {
            position: window.google.maps.ControlPosition.RIGHT_BOTTOM,
          },
          gestureHandling: "greedy",
        });
        setMapReady(true);
      })
      .catch((error) => !cancelled && setMapError(error.message));
    return () => {
      cancelled = true;
      if (trafficRef.current) trafficRef.current.setMap(null);
    };
  }, [hasLocation, latitude, longitude]);
  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map || !hasLocation) return;
    const point = { lat: latitude, lng: longitude };
    if (!originRef.current)
      originRef.current = new window.google.maps.Marker({
        position: point,
        map,
        title: "Your live location",
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 9,
          fillColor: "#56e2ff",
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 3,
        },
      });
    else originRef.current.setPosition(point);
    if (!route) map.panTo(point);
  }, [latitude, longitude, hasLocation, route, mapReady]);
  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map || !hasLocation || recenterVersion === 0) return;
    map.panTo({ lat: latitude, lng: longitude });
    map.setZoom(15);
  }, [recenterVersion, mapReady, hasLocation, latitude, longitude]);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !hasLocation) return;
    routeRef.current?.setMap(null);
    destinationRef.current?.setMap(null);
    routeRef.current = null;
    destinationRef.current = null;
    if (!route) return;
    const path = window.google.maps.geometry.encoding.decodePath(
      route.polyline,
    );
    routeRef.current = new window.google.maps.Polyline({
      path,
      strokeColor: "#55defd",
      strokeOpacity: 0.95,
      strokeWeight: 6,
      map,
    });
    const end = path[path.length - 1];
    destinationRef.current = new window.google.maps.Marker({
      position: end,
      map,
      title: route.endAddress,
      icon: {
        path: window.google.maps.SymbolPath.BACKWARD_CLOSED_ARROW,
        scale: 6,
        fillColor: "#ffd46a",
        fillOpacity: 1,
        strokeColor: "#fff8d8",
        strokeWeight: 2,
      },
    });
    const bounds = new window.google.maps.LatLngBounds();
    path.forEach((point: any) => bounds.extend(point));
    map.fitBounds(bounds, 52);
  }, [route, hasLocation, latitude, longitude]);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !window.google?.maps) return;
    if (!trafficRef.current)
      trafficRef.current = new window.google.maps.TrafficLayer();
    trafficRef.current.setMap(traffic ? map : null);
  }, [traffic]);
  return (
    <>
      <div
        ref={elementRef}
        className="live-map"
        aria-label="Interactive Google map"
      />
      {mapError && <div className="map-load-error">{mapError}</div>}
    </>
  );
}

const quickSearches = [
  "Food",
  "Indian",
  "Coffee",
  "Petrol stations",
  "Pharmacy",
];
export default function NavigationView() {
  const { world, refresh } = useWorldContext();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<NavigationPlace[]>([]);
  const [nearby, setNearby] = useState<NearbyPlace[]>([]);
  const [destination, setDestination] = useState<NavigationPlace | null>(null);
  const [routes, setRoutes] = useState<NavigationRoute[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<NavigationRoute | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [discovering, setDiscovering] = useState(false);
  const [traffic, setTraffic] = useState(false);
  const [error, setError] = useState("");
  const [locating, setLocating] = useState(false);
  const [recenterVersion, setRecenterVersion] = useState(0);
  const location = world?.location;
  const hasLocation =
    Number.isFinite(location?.latitude) && Number.isFinite(location?.longitude);
  async function handleSearch(event: FormEvent) {
    event.preventDefault();
    if (query.trim().length < 2) return;
    setLoading(true);
    setError("");
    setNearby([]);
    try {
      setResults(await searchLocations(query.trim()));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Location search failed.");
    } finally {
      setLoading(false);
    }
  }
  async function discover(queryText: string) {
    if (!hasLocation) {
      setError("Your live location is still being acquired.");
      return;
    }
    setDiscovering(true);
    setError("");
    setResults([]);
    setNearby([]);
    try {
      setNearby(await discoverNearby(queryText));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Nearby recommendations failed.",
      );
    } finally {
      setDiscovering(false);
    }
  }
  async function selectDestination(place: NavigationPlace) {
    setDestination(place);
    setResults([]);
    setNearby([]);
    setQuery(place.name);
    setRoutes([]);
    setSelectedRoute(null);
    setError("");
    if (!hasLocation) {
      setError(
        "Your live location is still being acquired. Try again in a moment.",
      );
      return;
    }
    setLoading(true);
    try {
      const result = await getRoute(place.latitude, place.longitude);
      setRoutes(result.routes);
      setSelectedRoute(result.routes[0] ?? null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Route calculation failed.",
      );
    } finally {
      setLoading(false);
    }
  }
  async function refreshCurrentLocation() {
    setLocating(true);
    setError("");
    try {
      await updateLocation();
      await refresh();
      setRecenterVersion((value) => value + 1);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Windows could not provide your location.",
      );
    } finally {
      setLocating(false);
    }
  }
  return (
    <div className="navigation-view">
      <header className="navigation-heading">
        <div>
          <p>NAVIGATION CONSOLE</p>
          <h1>Find your way</h1>
          <span>Live traffic, nearby recommendations, and guided routes.</span>
        </div>
        <button
          className="navigation-locate"
          disabled={locating}
          onClick={() => void refreshCurrentLocation()}
        >
          <Crosshair size={17} /> {locating ? "Locating…" : "Refresh location"}
        </button>
      </header>
      <div className="navigation-layout">
        <section className="navigation-map-card">
          <LiveMap
            latitude={location?.latitude}
            longitude={location?.longitude}
            route={selectedRoute}
            traffic={traffic}
            recenterVersion={recenterVersion}
          />
          <div className="map-overlay">
            <MapPinned size={17} />
            <div>
              <strong>{location?.city ?? "Locating Sentinel..."}</strong>
              <span>
                {hasLocation
                  ? `${location?.latitude?.toFixed(5)}, ${location?.longitude?.toFixed(5)}`
                  : "Location permission required"}
              </span>
            </div>
          </div>
          <div className="map-actions">
            <button
              className="map-recenter"
              disabled={!hasLocation}
              onClick={() => setRecenterVersion((value) => value + 1)}
            >
              <Crosshair size={16} /> My location
            </button>
            <button
              className={`traffic-toggle ${traffic ? "is-active" : ""}`}
              onClick={() => setTraffic((value) => !value)}
            >
              <TrafficCone size={16} />{" "}
              {traffic ? "Traffic on" : "Show traffic"}
            </button>
          </div>
        </section>
        <aside className="navigation-panel">
          <form className="navigation-search" onSubmit={handleSearch}>
            <Search size={20} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search an address or landmark..."
            />
            <button type="submit" disabled={loading}>
              {loading ? "Searching..." : "Search"}
            </button>
          </form>
          <div className="nearby-toolbar">
            <span>
              <Star size={14} /> Explore nearby
            </span>
            <div>
              {quickSearches.map((item) => (
                <button
                  key={item}
                  onClick={() => void discover(item)}
                  disabled={discovering}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
          {error && (
            <div className="navigation-error">
              <X size={16} /> {error}
            </div>
          )}
          {discovering && (
            <p className="navigation-progress">
              Finding the best nearby options…
            </p>
          )}
          {results.length > 0 && (
            <div className="navigation-results">
              {results.map((place) => (
                <button
                  key={`${place.latitude}-${place.longitude}`}
                  onClick={() => void selectDestination(place)}
                >
                  <MapPinned size={18} />
                  <span>{place.name}</span>
                  <Navigation size={16} />
                </button>
              ))}
            </div>
          )}
          {nearby.length > 0 && (
            <div className="nearby-results">
              {nearby.map((place) => (
                <button
                  key={`${place.latitude}-${place.longitude}`}
                  onClick={() => void selectDestination(place)}
                >
                  <div>
                    <strong>{place.name}</strong>
                    <span>
                      {place.category} · {place.distance.toFixed(1)} mi away
                    </span>
                    <small>{place.address}</small>
                  </div>
                  <aside>
                    {place.rating && (
                      <b>
                        <Star size={13} fill="currentColor" />{" "}
                        {place.rating.toFixed(1)}
                      </b>
                    )}
                    {typeof place.openNow === "boolean" && (
                      <em className={place.openNow ? "open" : "closed"}>
                        {place.openNow ? "Open" : "Closed"}
                      </em>
                    )}
                  </aside>
                </button>
              ))}
            </div>
          )}
          {destination ? (
            <div className="destination-card">
              <div className="destination-label">
                <Route size={18} />
                <span>DESTINATION</span>
              </div>
              <h2>{destination.name}</h2>
              {routes.length > 0 ? (
                <>
                  <div className="route-options">
                    {routes.map((route, index) => (
                      <button
                        className={
                          selectedRoute?.id === route.id ? "selected" : ""
                        }
                        key={route.id}
                        onClick={() => setSelectedRoute(route)}
                      >
                        <strong>
                          {index === 0 ? "Recommended" : `Alternative ${index}`}
                        </strong>
                        <span>
                          {route.duration} · {route.distance}
                        </span>
                      </button>
                    ))}
                  </div>
                  {selectedRoute && (
                    <>
                      <div className="route-stats">
                        <div>
                          <Route />
                          <span>Distance</span>
                          <strong>{selectedRoute.distance}</strong>
                        </div>
                        <div>
                          <Clock3 />
                          <span>Traffic-aware time</span>
                          <strong>{selectedRoute.duration}</strong>
                        </div>
                      </div>
                      <div className="directions-list">
                        <h3>
                          <List size={16} /> Directions
                        </h3>
                        {selectedRoute.steps.map((step, index) => (
                          <div key={`${step.instruction}-${index}`}>
                            <b>{index + 1}</b>
                            <span>
                              {step.instruction}
                              <small>
                                {step.distance} · {step.duration}
                              </small>
                            </span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </>
              ) : (
                <p>
                  {loading
                    ? "Calculating alternative routes…"
                    : "Route information unavailable."}
                </p>
              )}
              <button
                className="clear-destination"
                onClick={() => {
                  setDestination(null);
                  setRoutes([]);
                  setSelectedRoute(null);
                  setQuery("");
                }}
              >
                <X size={15} /> Clear destination
              </button>
            </div>
          ) : (
            !nearby.length && (
              <div className="navigation-empty">
                <Navigation size={30} />
                <h2>Where would you like to go?</h2>
                <p>
                  Search an address, landmark, town or postcode — or use Explore
                  nearby for trusted local recommendations.
                </p>
              </div>
            )
          )}
          <div className="navigation-data">
            <strong>Live map services</strong>
            <span>
              Google Maps traffic and directions · Google Places recommendations
            </span>
          </div>
        </aside>
      </div>
    </div>
  );
}
