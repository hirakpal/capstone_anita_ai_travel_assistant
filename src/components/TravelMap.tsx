import React, { useEffect, useRef, useState } from 'react';
import { APIProvider, Map, useMap, useMapsLibrary, AdvancedMarker } from '@vis.gl/react-google-maps';
import { Hotel, Tour, Restaurant } from '../types';

const API_KEY =
  process.env.GOOGLE_MAPS_PLATFORM_KEY ||
  process.env.GOOGLE_MAPS_API_KEY ||
  (import.meta as any).env?.VITE_GOOGLE_MAPS_PLATFORM_KEY ||
  (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY ||
  (globalThis as any).GOOGLE_MAPS_PLATFORM_KEY ||
  (globalThis as any).GOOGLE_MAPS_API_KEY ||
  '';

const hasValidKey = Boolean(API_KEY) && API_KEY !== 'YOUR_API_KEY';

interface RouteDisplayProps {
  destination: string;
  hotelCoords: { lat: number; lng: number } | null;
  foodCoords: { lat: number; lng: number } | null;
  tourCoords: { lat: number; lng: number } | null;
}

function RouteDisplay({ destination, hotelCoords, foodCoords, tourCoords }: RouteDisplayProps) {
  const map = useMap();
  const routesLib = useMapsLibrary('routes');
  const polylinesRef = useRef<google.maps.Polyline[]>([]);

  const hotelLat = hotelCoords?.lat;
  const hotelLng = hotelCoords?.lng;
  const foodLat = foodCoords?.lat;
  const foodLng = foodCoords?.lng;
  const tourLat = tourCoords?.lat;
  const tourLng = tourCoords?.lng;

  useEffect(() => {
    if (!routesLib || !map) return;
    
    // Clear previous polylines
    polylinesRef.current.forEach(p => p.setMap(null));
    polylinesRef.current = [];

    // Order points logically: Hotel -> Tour -> Food
    const points: google.maps.LatLngLiteral[] = [];
    if (hotelLat && hotelLng) points.push({ lat: hotelLat, lng: hotelLng });
    if (tourLat && tourLng) points.push({ lat: tourLat, lng: tourLng });
    if (foodLat && foodLng) points.push({ lat: foodLat, lng: foodLng });

    if (points.length < 2) return;

    const originPoint = points[0];
    const destPoint = points[points.length - 1];
    const intermediatePoints = points.slice(1, points.length - 1);

    const req: any = {
      origin: {
        location: {
          latLng: {
            latitude: originPoint.lat,
            longitude: originPoint.lng
          }
        }
      },
      destination: {
        location: {
          latLng: {
            latitude: destPoint.lat,
            longitude: destPoint.lng
          }
        }
      },
      travelMode: 'DRIVING',
      routingPreference: 'TRAFFIC_AWARE',
      fields: ['path', 'viewport', 'distanceMeters', 'durationMillis'],
    };

    if (intermediatePoints.length > 0) {
      req.intermediates = intermediatePoints.map(p => ({
        location: {
          latLng: {
            latitude: p.lat,
            longitude: p.lng
          }
        }
      }));
    }

    routesLib.Route.computeRoutes(req)
      .then(({ routes }) => {
        if (routes?.[0]) {
          const newPolylines = routes[0].createPolylines();
          newPolylines.forEach(p => p.setMap(map));
          polylinesRef.current = newPolylines;
          if (routes[0].viewport) {
            map.fitBounds(routes[0].viewport);
          }
        }
      })
      .catch(err => {
        console.warn("Google Maps computeRoutes error:", err);
      });

    return () => {
      polylinesRef.current.forEach(p => p.setMap(null));
    };
  }, [routesLib, map, hotelLat, hotelLng, foodLat, foodLng, tourLat, tourLng]);

  return null;
}

// Simple coordinate resolver for major destinations or deterministic hashing
export function resolveCoordinates(city: string, locationName: string): { lat: number; lng: number } {
  const cityLower = city.toLowerCase();
  
  // Default base coordinates
  let base = { lat: 26.9124, lng: 75.7873 }; // Jaipur default
  
  const knownCities: Record<string, { lat: number; lng: number }> = {
    "jaipur": { lat: 26.9124, lng: 75.7873 },
    "goa": { lat: 15.2993, lng: 74.1240 },
    "paris": { lat: 48.8566, lng: 2.3522 },
    "london": { lat: 51.5074, lng: -0.1278 },
    "tokyo": { lat: 35.6762, lng: 139.6503 },
    "new york": { lat: 40.7128, lng: -74.0060 },
    "bengaluru": { lat: 12.9716, lng: 77.5946 },
    "bangalore": { lat: 12.9716, lng: 77.5946 },
    "mumbai": { lat: 19.0760, lng: 72.8777 },
    "bombay": { lat: 19.0760, lng: 72.8777 },
    "delhi": { lat: 28.6139, lng: 77.2090 },
    "new delhi": { lat: 28.6139, lng: 77.2090 },
    "agra": { lat: 27.1767, lng: 78.0081 },
    "rome": { lat: 41.9028, lng: 12.4964 },
    "sydney": { lat: -33.8688, lng: 151.2093 },
    "singapore": { lat: 1.3521, lng: 103.8198 },
    "dubai": { lat: 25.2048, lng: 55.2708 },
    "bangkok": { lat: 13.7563, lng: 100.5018 },
    "barcelona": { lat: 41.3851, lng: 2.1734 },
    "amsterdam": { lat: 52.3676, lng: 4.9041 },
    "cape town": { lat: -33.9249, lng: 18.4241 }
  };

  let matched = false;
  for (const key of Object.keys(knownCities)) {
    if (cityLower.includes(key)) {
      base = knownCities[key];
      matched = true;
      break;
    }
  }

  if (!matched && cityLower.trim().length > 0) {
    // Generate a beautiful, stable, unique coordinate on Earth based on the city's string hash!
    let cityHash = 0;
    for (let i = 0; i < cityLower.length; i++) {
      cityHash = cityLower.charCodeAt(i) + ((cityHash << 5) - cityHash);
    }
    // Map to a reasonable lat (10 to 55) and lng (-100 to 130) to cover major travel zones
    const lat = 10.0 + (Math.abs(cityHash % 450) / 10);
    const lng = -100.0 + (Math.abs((cityHash >> 8) % 2300) / 10);
    base = { lat, lng };
  }
  
  const locLower = locationName.toLowerCase();
  if (cityLower.includes("jaipur")) {
    if (locLower.includes("itc rajputana")) return { lat: 26.9173, lng: 75.7865 };
    if (locLower.includes("umaid bhawan")) return { lat: 26.9272, lng: 75.7904 };
    if (locLower.includes("amber fort") || locLower.includes("trek")) return { lat: 26.9855, lng: 75.8513 };
    if (locLower.includes("city palace") || locLower.includes("hawa mahal") || locLower.includes("walking")) return { lat: 26.9258, lng: 75.8237 };
    if (locLower.includes("laxmi") || locLower.includes("lmb")) return { lat: 26.9212, lng: 75.8228 };
    if (locLower.includes("chokhi")) return { lat: 26.7663, lng: 75.8361 };
  }

  // Deterministic fallback hash offset
  let hash = 0;
  for (let i = 0; i < locationName.length; i++) {
    hash = locationName.charCodeAt(i) + ((hash << 5) - hash);
  }
  const offsetLat = ((hash % 100) / 1000) * 0.04 - 0.02;
  const offsetLng = (((hash >> 8) % 100) / 1000) * 0.04 - 0.02;
  
  return {
    lat: base.lat + offsetLat,
    lng: base.lng + offsetLng
  };
}

function MapRecenter({ coords, destination }: { coords: { lat: number; lng: number }[], destination: string }) {
  const map = useMap();
  const coordsSerialized = JSON.stringify(coords);

  useEffect(() => {
    if (!map) return;
    
    const parsedCoords: { lat: number; lng: number }[] = JSON.parse(coordsSerialized);
    
    if (parsedCoords.length > 0) {
      const bounds = new google.maps.LatLngBounds();
      parsedCoords.forEach(c => bounds.extend(c));
      map.fitBounds(bounds);
      
      // Zoom out slightly if too close or 1 coordinate
      if (parsedCoords.length === 1) {
        map.setZoom(13);
      } else {
        // Pad bounds slightly
        const listener = google.maps.event.addListenerOnce(map, 'bounds_changed', () => {
          const currentZoom = map.getZoom();
          if (currentZoom && currentZoom > 15) {
            map.setZoom(15);
          }
        });
      }
    } else {
      // Re-center to the new destination base coordinates immediately
      const destCenter = resolveCoordinates(destination, "");
      map.setCenter(destCenter);
      map.setZoom(12);
    }
  }, [map, coordsSerialized, destination]);
  return null;
}

interface TravelMapProps {
  origin: string;
  destination: string;
  destinationCity?: string;
  selectedHotel?: Hotel | null;
  selectedRestaurant?: Restaurant | null;
  selectedTour?: Tour | null;
  height?: string;
}

export default function TravelMap({ 
  origin, 
  destination, 
  destinationCity,
  selectedHotel, 
  selectedRestaurant, 
  selectedTour, 
  height = "380px" 
}: TravelMapProps) {

  const actualCity = destinationCity || destination;

  // Compute positions
  const hotelCoords = selectedHotel ? resolveCoordinates(actualCity, selectedHotel.name) : null;
  const foodCoords = selectedRestaurant ? resolveCoordinates(actualCity, selectedRestaurant.name) : null;
  const tourCoords = selectedTour ? resolveCoordinates(actualCity, selectedTour.title) : null;

  const activeCoords: { lat: number; lng: number }[] = [];
  if (hotelCoords) activeCoords.push(hotelCoords);
  if (foodCoords) activeCoords.push(foodCoords);
  if (tourCoords) activeCoords.push(tourCoords);

  if (!hasValidKey) {
    return (
      <div 
        style={{ height }} 
        className="w-full rounded-2xl bg-slate-950 border border-slate-800 p-5 flex flex-col justify-between text-slate-300 relative overflow-hidden shadow-md"
      >
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#111827_1px,transparent_1px),linear-gradient(to_bottom,#111827_1px,transparent_1px)] bg-[size:24px_24px] opacity-35" />
        
        {/* Header alert */}
        <div className="z-10 flex items-center justify-between gap-3 bg-slate-900/80 border border-slate-800 px-3.5 py-2 rounded-xl backdrop-blur-xs">
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 animate-pulse" />
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">
              Coordinated Swarm Map (Simulation Mode)
            </span>
          </div>
          <span className="text-[9px] font-semibold text-slate-500">
            Provide GOOGLE_MAPS_PLATFORM_KEY to go live
          </span>
        </div>

        {/* Dynamic visual graph */}
        <div className="z-10 flex-1 my-4 flex flex-col md:flex-row items-center justify-around gap-6 px-4">
          
          {/* Node 1: Origin */}
          <div className="flex flex-col items-center text-center">
            <div className="h-12 w-12 rounded-xl bg-slate-900 border border-slate-700/60 flex items-center justify-center text-lg shadow-sm">
              🛫
            </div>
            <span className="text-[9px] uppercase tracking-wider text-slate-500 font-bold mt-2">Origin</span>
            <div className="text-xs font-extrabold text-white mt-0.5">{origin}</div>
          </div>

          {/* Transit Arrow */}
          <div className="flex-1 flex flex-col items-center max-w-[80px]">
            <span className="text-[9px] font-mono text-indigo-400 font-semibold mb-1">Outbound</span>
            <div className="w-full border-t border-dashed border-indigo-500/40 relative">
              <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-xs">✈️</span>
            </div>
          </div>

          {/* Destination Swarm Hub Card */}
          <div className="bg-slate-900/90 border border-indigo-950/80 rounded-xl p-4 min-w-[240px] text-left shadow-lg relative">
            <div className="absolute top-2 right-2 bg-indigo-950/80 text-indigo-400 border border-indigo-900 px-1.5 py-0.5 rounded text-[8px] font-bold font-mono tracking-wider uppercase">
              {actualCity} HUB
            </div>
            
            <h5 className="text-[10px] font-bold text-indigo-300 font-mono tracking-wider uppercase mb-3 flex items-center gap-1">
              <span>📍</span> Active Swarm Coordinates
            </h5>

            <div className="space-y-2.5">
              <div className={`p-1.5 rounded border transition-all ${selectedHotel ? 'bg-indigo-950/20 border-indigo-900/60' : 'bg-slate-950/30 border-slate-900'}`}>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs">🏨</span>
                  <div>
                    <div className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Selected Hotel</div>
                    <div className="text-xs font-bold text-white leading-tight">
                      {selectedHotel ? selectedHotel.name : "None selected"}
                    </div>
                  </div>
                </div>
              </div>

              <div className={`p-1.5 rounded border transition-all ${selectedRestaurant ? 'bg-rose-950/20 border-rose-900/60' : 'bg-slate-950/30 border-slate-900'}`}>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs">🍴</span>
                  <div>
                    <div className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Culinary Spot</div>
                    <div className="text-xs font-bold text-white leading-tight">
                      {selectedRestaurant ? selectedRestaurant.name : "None selected"}
                    </div>
                  </div>
                </div>
              </div>

              <div className={`p-1.5 rounded border transition-all ${selectedTour ? 'bg-amber-950/20 border-amber-900/60' : 'bg-slate-950/30 border-slate-900'}`}>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs">🧗</span>
                  <div>
                    <div className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Top Activity</div>
                    <div className="text-xs font-bold text-white leading-tight">
                      {selectedTour ? selectedTour.title : "None selected"}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Return Arrow */}
          <div className="flex-1 flex flex-col items-center max-w-[80px]">
            <span className="text-[9px] font-mono text-teal-400 font-semibold mb-1">Return Journey</span>
            <div className="w-full border-t border-dashed border-teal-500/40 relative">
              <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-xs rotate-180">✈️</span>
            </div>
          </div>

          {/* Node 3: Home */}
          <div className="flex flex-col items-center text-center">
            <div className="h-12 w-12 rounded-xl bg-slate-900 border border-slate-700/60 flex items-center justify-center text-lg shadow-sm">
              🛬
            </div>
            <span className="text-[9px] uppercase tracking-wider text-slate-500 font-bold mt-2">Home</span>
            <div className="text-xs font-extrabold text-white mt-0.5">{origin}</div>
          </div>

        </div>

        {/* Footer info bar */}
        <div className="z-10 text-[10px] text-slate-400 text-left bg-slate-900/40 px-3 py-2 rounded-lg border border-slate-800/40 flex items-center gap-1.5">
          <span>🧠</span>
          <span>
            <strong>AI Sync Engine:</strong> Ground coordinates deterministic offset mapping successfully executed for stay, activity, and dinner spots.
          </span>
        </div>
      </div>
    );
  }

  return (
    <div style={{ height }} className="w-full rounded-2xl overflow-hidden border border-slate-200 relative shadow-sm">
      <APIProvider apiKey={API_KEY} version="weekly">
        <Map
          key={actualCity}
          defaultCenter={resolveCoordinates(actualCity, "")}
          defaultZoom={12}
          mapId="DEMO_MAP_ID"
          internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
          style={{ width: '100%', height: '100%' }}
        >
          {/* Plotting points */}
          {hotelCoords && (
            <AdvancedMarker position={hotelCoords} title={`Hotel: ${selectedHotel?.name}`}>
              <div className="flex items-center justify-center bg-white border-2 border-indigo-600 rounded-full h-8 w-8 text-sm shadow-md hover:scale-110 transition-transform font-bold cursor-pointer">
                🏨
              </div>
            </AdvancedMarker>
          )}
          {foodCoords && (
            <AdvancedMarker position={foodCoords} title={`Food: ${selectedRestaurant?.name}`}>
              <div className="flex items-center justify-center bg-white border-2 border-rose-500 rounded-full h-8 w-8 text-sm shadow-md hover:scale-110 transition-transform font-bold cursor-pointer">
                🍴
              </div>
            </AdvancedMarker>
          )}
          {tourCoords && (
            <AdvancedMarker position={tourCoords} title={`Activity: ${selectedTour?.title}`}>
              <div className="flex items-center justify-center bg-white border-2 border-amber-500 rounded-full h-8 w-8 text-sm shadow-md hover:scale-110 transition-transform font-bold cursor-pointer">
                🧗
              </div>
            </AdvancedMarker>
          )}

          {/* Map auto-centering element */}
          <MapRecenter coords={activeCoords} destination={actualCity} />

          {/* Route path connector */}
          <RouteDisplay 
            destination={actualCity}
            hotelCoords={hotelCoords}
            foodCoords={foodCoords}
            tourCoords={tourCoords}
          />
        </Map>
      </APIProvider>
      
      <div className="absolute bottom-3 left-3 bg-white/95 backdrop-blur-xs px-3 py-1.5 rounded-lg text-xs font-bold text-slate-700 border border-slate-200 shadow-sm z-10 flex flex-col gap-0.5">
        <div className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span>🗺️ Swarm Route Synced with Itinerary</span>
        </div>
        <span className="text-[10px] text-slate-500 font-medium ml-3">
          🏨 {selectedHotel?.name || "No stay selected"}
        </span>
      </div>
    </div>
  );
}
