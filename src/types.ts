export interface Flight {
  airline: string;
  route: string;
  price_range: string;
  reviews?: { rating: string };
  constraint_applied?: string;
  url?: string;
}

export interface Hotel {
  name: string;
  location?: string;
  price: string;
  rating: string;
  popularity: string;
  checkout_time?: string;
  checkout_details?: string;
  raw_output?: string;
  error?: string;
}

export interface TransportOption {
  name: string;
  price: string;
  rating: string;
  popularity: string;
  distance?: string;
  duration?: string;
}

export interface Tour {
  title: string;
  price: string;
  rating: string;
  popularity: string;
  location?: string;
}

export interface Restaurant {
  name: string;
  price: string;
  rating: string;
  popularity: string;
  distance?: string;
  duration?: string;
  cuisine?: string;
}

export interface ImpactReport {
  sustainability: {
    carbon_score: string;
    eco_alternatives: string[];
  };
  risk: {
    weather: string;
    political: string;
    risk_level: string;
  };
  wellbeing: {
    activity_balance: string;
    recommendation: string;
  };
  cultural_fit: {
    sensitivity: string;
    dietary: string;
  };
  budget: {
    flag: string;
    alternatives: string[];
  };
  accessibility: {
    wheelchair_friendly_hotels: string[];
    accessible_tours: string[];
  };
  health: {
    altitude_risk: string;
    vaccination_advisories: string[];
  };
  time_preferences: {
    morning_activities: string[];
    evening_activities: string[];
  };
  group_dynamics: {
    shared_activities: string[];
    solo_activities: string[];
  };
  alternates: {
    hotel?: string[];
    transport?: string[];
    tour?: string[];
  };
}

export interface WeatherData {
  forecast: string;
  temperature?: string;
}

export interface OrchestratedResults {
  flight?: { flights: Flight[]; return_flights?: Flight[] };
  hotel?: { hotels: Hotel[] };
  transport?: { options: TransportOption[] };
  tour?: { tour_summary: { tours: Tour[] } };
  food?: { restaurants: Restaurant[] };
  impact_assessment?: ImpactReport;
  impact_narrative?: string;
  weather?: WeatherData;
  alternate_options?: {
    hotel?: { hotels: Hotel[] };
    transport?: { options: TransportOption[] };
    tour?: { tour_summary: { tours: Tour[] } };
  };
  fromCache?: boolean;
  cacheTimestamp?: number;
  tokensSaved?: number;
}

export interface TravelState {
  origin: string;
  destination: string;
  arrival_time: string;
  departure_time: string;
  traveler_type: string;
  cuisine_preference: string;
}
