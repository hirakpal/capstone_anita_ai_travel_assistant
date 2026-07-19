import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";

const app = express();
app.use(express.json());

const PORT = 3000;

let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is required. Please set it in Settings > Secrets.");
  }
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// ---------------- SERVER-SIDE CACHE CONFIG ----------------
interface CacheEntry {
  data: any;
  timestamp: number;
}
const orchestrateCache = new Map<string, CacheEntry>();
const chatCache = new Map<string, { reply: string; timestamp: number }>();

function getCacheKey(origin: string, destination: string, cuisine: string, travelerType: string, arrival: string, departure: string): string {
  return [origin, destination, cuisine, travelerType, arrival, departure]
    .map(s => (s || "").toString().toLowerCase().trim())
    .join("||");
}

// ---------------- DEMO DATA GENERATOR ----------------
function generateDemoData(origin: string, destination: string, cuisine: string, travelerType: string) {
  const destClean = (destination || "").toLowerCase().trim();
  const cuisinePref = cuisine || "Any";
  
  let hotelsList = [];
  let toursList = [];
  let restaurantsList = [];
  let forecastText = "Clear and Sunny";
  let tempText = "32°C";
  let narrativeText = "";

  if (destClean.includes("jaipur")) {
    forecastText = "Sunny but high heat index";
    tempText = "37°C";
    narrativeText = `For your trip to the historic Pink City of Jaipur, we have synthesized 6 distinct premium and heritage options. Laxmi Misthan Bhandar (LMB) provides standard Rajasthani vegetarian delicacies matching your ${cuisinePref} culinary guidelines, while historic cycling tracks and blue pottery workshops offer highly engaging cultural immersion options for a multi-day itinerary.`;
    hotelsList = [
      {
        name: "ITC Rajputana Jaipur",
        location: "Palace Road, Jaipur",
        price: "₹12,000 / night",
        rating: "4.7",
        popularity: "🔥 Highly Recommended Luxury Palace",
        checkout_time: "11:00 AM",
        checkout_details: "Express checkout. AI-scheduled airport shuttle is set for 11:30 AM to match your return flight perfectly."
      },
      {
        name: "Umaid Bhawan Heritage Hotel",
        location: "Bani Park, Jaipur",
        price: "₹4,500 / night",
        rating: "4.5",
        popularity: "👍 Great Value Heritage Mansion",
        checkout_time: "12:00 PM",
        checkout_details: "Classic heritage checkout. Transit to airport takes ~35 minutes. Settle keys at lobby desk."
      },
      {
        name: "The Rambagh Palace",
        location: "Bhawani Singh Road, Jaipur",
        price: "₹35,000 / night",
        rating: "4.9",
        popularity: "👑 Royal Splendor (Taj Group)",
        checkout_time: "12:00 PM",
        checkout_details: "Premium butler assistance. Pre-cleared private limousine transfer included."
      },
      {
        name: "Pearl Palace Heritage Boutique Hotel",
        location: "Ajmer Road, Jaipur",
        price: "₹3,200 / night",
        rating: "4.6",
        popularity: "🎨 Highly rated art-deco boutique",
        checkout_time: "11:00 AM",
        checkout_details: "Local artisan-decorated rooms. Standard billing checkout."
      },
      {
        name: "Zostel Jaipur Hostel",
        location: "Hawa Mahal Road, Jaipur",
        price: "₹800 / night",
        rating: "4.4",
        popularity: "🎒 Backpacker and Solo Choice",
        checkout_time: "10:00 AM",
        checkout_details: "Self-service keys box. Baggage lockers available post-checkout."
      },
      {
        name: "Lohagarh Fort Eco-Resort",
        location: "Kukas, Jaipur Outskirts",
        price: "₹9,500 / night",
        rating: "4.5",
        popularity: "🌿 Sustainable Glamping & Spa",
        checkout_time: "11:00 AM",
        checkout_details: "Eco-property organic checks. Allow 50 mins travel time to central town."
      }
    ];

    toursList = [
      {
        title: "Amber Fort & Palace Guided Trek",
        price: "₹1,000",
        rating: "4.8",
        popularity: "🔥 Top Landmark Activity",
        location: "Amber Fort, Jaipur"
      },
      {
        title: "City Palace & Hawa Mahal Walking Tour",
        price: "₹500",
        rating: "4.6",
        popularity: "📸 Iconic photo spots & museum guide",
        location: "Old City, Jaipur"
      },
      {
        title: "Jantar Mantar Royal Observatory Exploration",
        price: "₹300",
        rating: "4.5",
        popularity: "📐 Astronomical instruments guide",
        location: "Opposite City Palace, Jaipur"
      },
      {
        title: "Nahargarh Fort Sunset Cycling Expedition",
        price: "₹1,200",
        rating: "4.7",
        popularity: "🚴 Adventure trek up the hills",
        location: "Nahargarh Hills, Jaipur"
      },
      {
        title: "Jaipur Hand Block Blue Pottery Class",
        price: "₹1,500",
        rating: "4.4",
        popularity: "🎨 Dynamic hands-on craft workshop",
        location: "Sanganer Road, Jaipur"
      },
      {
        title: "Secret Old Bazaars & Gemstone Walk",
        price: "₹700",
        rating: "4.3",
        popularity: "🛍️ Local artisan secrets and spices",
        location: "Johari Bazaar, Jaipur"
      }
    ];

    restaurantsList = [
      {
        name: "Laxmi Misthan Bhandar (LMB)",
        price: "₹600 for two",
        rating: "4.6",
        popularity: "🔥 Legend of local sweets & Royal Thali",
        distance: "1.2 km",
        duration: "5 mins",
        cuisine: cuisinePref !== "Any" ? cuisinePref : "Vegetarian (Rajasthani Thali)"
      },
      {
        name: "Chokhi Dhani Ethnic Resort & Feast",
        price: "₹2,000 for two",
        rating: "4.5",
        popularity: "🎭 Interactive cultural feast village",
        distance: "18 km",
        duration: "40 mins",
        cuisine: "Rajasthani Traditional Buffet"
      },
      {
        name: "Tapri The Tea House (Rooftop)",
        price: "₹500 for two",
        rating: "4.7",
        popularity: "🌅 Trendy local sunset tea lounge",
        distance: "2.5 km",
        duration: "8 mins",
        cuisine: "Modern Indian & Local Chai snacks"
      },
      {
        name: "Baradari Restaurant at City Palace",
        price: "₹2,500 for two",
        rating: "4.6",
        popularity: "🥂 Fine dining inside royal courtyards",
        distance: "0.5 km",
        duration: "2 mins",
        cuisine: "Royal Contemporary Fusion"
      },
      {
        name: "Sanjay Omelette Corner",
        price: "₹300 for two",
        rating: "4.4",
        popularity: "🍳 Street food icon featured on food networks",
        distance: "3.1 km",
        duration: "10 mins",
        cuisine: "Indian Street Egg Delicacies"
      },
      {
        name: "Peacock Rooftop Restaurant",
        price: "₹1,200 for two",
        rating: "4.5",
        popularity: "🎵 Scenic candlelit music dining",
        distance: "2.2 km",
        duration: "7 mins",
        cuisine: "North Indian & Pan-Asian"
      }
    ];
  } else if (destClean.includes("goa")) {
    forecastText = "Humid with sea breezes";
    tempText = "30°C";
    narrativeText = `For your coastal retreat in Goa, we've designed 6 rich options. From heritage Portuguese tours in Fontainhas to private catamaran beach excursions, your ${travelerType} trip is customized to maximize local coastal charm. Restaurants are tailored to your ${cuisinePref} preference, highlighting both traditional Goan fish-curries (or vegetarian equivalents) and trendy garden bistros.`;
    hotelsList = [
      {
        name: "Taj Exotica Resort & Spa Goa",
        location: "Benaulim Beach, South Goa",
        price: "₹18,000 / night",
        rating: "4.8",
        popularity: "🔥 Luxury Beachfront Hideout",
        checkout_time: "11:00 AM",
        checkout_details: "Baggage assistance to airport cab. Pre-departure checkout complete."
      },
      {
        name: "Santana Beach Resort",
        location: "Candolim, North Goa",
        price: "₹4,000 / night",
        rating: "4.4",
        popularity: "👍 Great Value Sea-facing resort",
        checkout_time: "11:00 AM",
        checkout_details: "Settle room bills by cash/card. Poolside access available after keys."
      },
      {
        name: "W Goa",
        location: "Vagator Beach, North Goa",
        price: "₹24,000 / night",
        rating: "4.7",
        popularity: "🎵 Vibrant, modern and stylish luxury",
        checkout_time: "12:00 PM",
        checkout_details: "Express checkout available. Private lounge access until boarding."
      },
      {
        name: "Ahilya by the Sea",
        location: "Nerul, North Goa",
        price: "₹15,000 / night",
        rating: "4.9",
        popularity: "🎨 Highly exclusive designer boutique villas",
        checkout_time: "11:00 AM",
        checkout_details: "Continental breakfast check. Direct private cab booking."
      },
      {
        name: "Pappi Chulo Backpacker Hostel",
        location: "Ozran Beach, Vagator",
        price: "₹700 / night",
        rating: "4.3",
        popularity: "🎒 Budget social backpacker central",
        checkout_time: "10:00 AM",
        checkout_details: "Return bedsheets to desk. Social café area open until night."
      },
      {
        name: "Wildernest Nature Eco-Resort",
        location: "Chorla Ghats, Goa Border",
        price: "₹7,500 / night",
        rating: "4.6",
        popularity: "🌿 Sustainable Jungle Ridge Infinity Pool",
        checkout_time: "11:00 AM",
        checkout_details: "Eco-property checks. Ensure 1.5h transit time back to coastal airport."
      }
    ];

    toursList = [
      {
        title: "Dudhsagar Waterfalls & Spice Plantation Trek",
        price: "₹2,000",
        rating: "4.7",
        popularity: "🌲 Stunning falls, offroad jeep safari & lunch",
        location: "Kolem, Goa"
      },
      {
        title: "Old Goa Portuguese Churches Walking Tour",
        price: "₹600",
        rating: "4.5",
        popularity: "⛪ UNESCO World Heritage architectural walking guide",
        location: "Old Goa"
      },
      {
        title: "Scuba Diving & Reef Exploration at Grand Island",
        price: "₹3,500",
        rating: "4.6",
        popularity: "🤿 Undersea dive experience with boat lunch",
        location: "Grand Island, Goa"
      },
      {
        title: "Fontainhas Latin Quarter Photography Walk",
        price: "₹500",
        rating: "4.6",
        popularity: "🎨 Colorful heritage street guide",
        location: "Panaji, Goa"
      },
      {
        title: "Mandovi River Sunset Luxury Cruise",
        price: "₹1,500",
        rating: "4.4",
        popularity: "⛵ Scenic river sailing with traditional music",
        location: "Panaji Ferry Terminal"
      },
      {
        title: "Backwater Kayaking & Birdwatching in Sal River",
        price: "₹1,200",
        rating: "4.5",
        popularity: "🛶 Quiet nature paddling through mangroves",
        location: "Cavelossim, Goa"
      }
    ];

    restaurantsList = [
      {
        name: "Mum's Kitchen (Panaji)",
        price: "₹1,500 for two",
        rating: "4.6",
        popularity: "🔥 Historic preserver of local Goan recipes",
        distance: "4.2 km",
        duration: "10 mins",
        cuisine: "Authentic Goan Saraswat Cuisine"
      },
      {
        name: "Curlies Beach Shack (Anjuna)",
        price: "₹1,000 for two",
        rating: "4.3",
        popularity: "🍹 Famous beach waves, music & seafood/veg classics",
        distance: "12 km",
        duration: "25 mins",
        cuisine: "Beachfront Multi-cuisine & Coastal Snacks"
      },
      {
        name: "Gunpowder Restaurant (Assagao)",
        price: "₹1,800 for two",
        rating: "4.7",
        popularity: "🏡 Southern coastal fusion in a cozy heritage garden",
        distance: "15 km",
        duration: "30 mins",
        cuisine: "Peninsular South Indian Coastal"
      },
      {
        name: "Thalassa Greek Taverna (Siolim)",
        price: "₹2,500 for two",
        rating: "4.5",
        popularity: "🌅 Sunset ocean views & Greek fire dance shows",
        distance: "18 km",
        duration: "35 mins",
        cuisine: "Greek Mediterranean Grill"
      },
      {
        name: "Martin's Corner (Betalbatim)",
        price: "₹1,400 for two",
        rating: "4.6",
        popularity: "🎵 Legendary celebrity restaurant with live retro music",
        distance: "25 km",
        duration: "45 mins",
        cuisine: "Goan Seafood, Steaks & Indian classics"
      },
      {
        name: "Artjuna Garden Cafe (Anjuna)",
        price: "₹800 for two",
        rating: "4.4",
        popularity: "🌳 Trendy lifestyle courtyard with organic bites",
        distance: "11 km",
        duration: "22 mins",
        cuisine: "Mediterranean Health Café & Bakery"
      }
    ];
  } else if (destClean.includes("paris")) {
    forecastText = "Mild and romantic, occasional light showers";
    tempText = "21°C";
    narrativeText = `Welcome to the City of Light! We have planned a beautiful multi-day selection of 6 distinct Parisian options. The Eiffel Tower summits, Louvre private guides, and classic Seine cruises are balanced by cozy Latin Quarter bistros matching your ${cuisinePref} criteria. This avoids repeating activities and guarantees a highly curated travel blueprint.`;
    hotelsList = [
      {
        name: "Ritz Paris",
        location: "Place Vendôme, Paris",
        price: "₹85,000 / night",
        rating: "4.9",
        popularity: "🔥 Ultimate Luxury Palace Stay",
        checkout_time: "12:00 PM",
        checkout_details: "Concierge baggage handling directly to airport chauffeur."
      },
      {
        name: "Hotel Caron de Beaumarchais",
        location: "Le Marais, Paris",
        price: "₹16,000 / night",
        rating: "4.6",
        popularity: "👍 Historic Boutique 18th-century setting",
        checkout_time: "11:00 AM",
        checkout_details: "Settle room tax and minibar. Parisian breakfast served until checkout."
      },
      {
        name: "Generator Hostel Paris",
        location: "Canal Saint-Martin, Paris",
        price: "₹3,200 / night",
        rating: "4.2",
        popularity: "🎒 Trendy, vibrant, highly affordable",
        checkout_time: "10:00 AM",
        checkout_details: "Return cards to the quick lobby box. Lockers on ground floor."
      },
      {
        name: "Kube Hotel Paris",
        location: "Montmartre Outskirts, Paris",
        price: "₹18,000 / night",
        rating: "4.4",
        popularity: "🧊 Cyberpunk design hotel with custom Ice Bar",
        checkout_time: "11:00 AM",
        checkout_details: "Digital check-out via room pad or lobby reception."
      },
      {
        name: "Hidden Hotel Paris Eco-Boutique",
        location: "Arc de Triomphe, Paris",
        price: "₹22,000 / night",
        rating: "4.7",
        popularity: "🌿 Organic wood design, sustainable focus",
        checkout_time: "12:00 PM",
        checkout_details: "Eco-reporting checkout complete. Organic tea served on departure."
      },
      {
        name: "Hotel Regina Louvre",
        location: "Rue de Rivoli, Paris",
        price: "₹38,000 / night",
        rating: "4.8",
        popularity: "👑 Grand classic French luxury with Louvre Views",
        checkout_time: "12:00 PM",
        checkout_details: "Private taxi queue prioritised. Express baggage holding."
      }
    ];

    toursList = [
      {
        title: "Eiffel Tower Summit Priority Access",
        price: "₹3,800",
        rating: "4.7",
        popularity: "🔥 Top Icon Attraction",
        location: "Champ de Mars, Paris"
      },
      {
        title: "Louvre Museum Masterpieces Guided Tour",
        price: "₹4,500",
        rating: "4.8",
        popularity: "🖼️ Private guide to Mona Lisa & Winged Victory",
        location: "Louvre Museum, Paris"
      },
      {
        title: "Seine River Twilight Romantic Dinner Cruise",
        price: "₹6,000",
        rating: "4.5",
        popularity: "🍷 Gourmet dining with lit up historic monuments",
        location: "Bateaux Parisiens Dock"
      },
      {
        title: "Montmartre Bohemian Artists walking Tour",
        price: "₹1,200",
        rating: "4.6",
        popularity: "🎨 Sacré-Cœur vistas, street art & historic cafes",
        location: "Montmartre, Paris"
      },
      {
        title: "Palace of Versailles Grand Day Trip",
        price: "₹2,800",
        rating: "4.7",
        popularity: "👑 Hall of Mirrors, gardens entry & audio guide",
        location: "Versailles"
      },
      {
        title: "Paris Underground Catacombs Adventure",
        price: "₹2,500",
        rating: "4.4",
        popularity: "💀 Historic subterranean network exploration",
        location: "Denfert-Rochereau, Paris"
      }
    ];

    restaurantsList = [
      {
        name: "Le Jules Verne (Eiffel Tower)",
        price: "₹18,000 for two",
        rating: "4.8",
        popularity: "🔥 Michelin-star fine dining with sky views",
        distance: "3.5 km",
        duration: "12 mins",
        cuisine: "Contemporary French Gastronomy"
      },
      {
        name: "Angelina Paris (Rue de Rivoli)",
        price: "₹2,200 for two",
        rating: "4.5",
        popularity: "☕ Famous African Hot Chocolate & pastries",
        distance: "0.2 km",
        duration: "1 min walk",
        cuisine: "Classic French Tea Room & Patisserie"
      },
      {
        name: "Bouillon Chartier (Grands Boulevards)",
        price: "₹1,200 for two",
        rating: "4.3",
        popularity: "🍽️ Legendary 19th-century grand bistro with budget prices",
        distance: "2.1 km",
        duration: "7 mins",
        cuisine: "Traditional French Comfort Food"
      },
      {
        name: "Pink Mamma (Pigalle)",
        price: "₹2,800 for two",
        rating: "4.6",
        popularity: "🇮🇹 Instagram-famous multi-floor greenhouse trattoria",
        distance: "3.2 km",
        duration: "11 mins",
        cuisine: "Tuscan Italian & Wood-fired Pizza"
      },
      {
        name: "L'As du Fallafel (Le Marais)",
        price: "₹800 for two",
        rating: "4.7",
        popularity: "🥙 World-famous falafel pit with long energetic lines",
        distance: "1.5 km",
        duration: "5 mins",
        cuisine: "Middle Eastern Street Food & Falafel"
      },
      {
        name: "Odette Paris Cafe",
        price: "₹1,000 for two",
        rating: "4.4",
        popularity: "🧁 Cozy cafe overlooking Notre Dame specialty pastries",
        distance: "0.8 km",
        duration: "3 mins",
        cuisine: "Parisian Choux Pastries & Fine Espresso"
      }
    ];
  } else if (destClean.includes("tokyo")) {
    forecastText = "Crisp and clear skies";
    tempText = "18°C";
    narrativeText = `Konnichiwa! Your Tokyo adventure has been populated with 6 highly distinct experiences. Dive into futuristic teamLab digital exhibits, traditional Meiji Shrine history, or local ramen tasting booths. We've ensured that all hotel stays, tours, and culinary listings are robustly varied so that each day of your ${travelerType} trip has unique landmarks.`;
    hotelsList = [
      {
        name: "Aman Tokyo",
        location: "Otemachi, Tokyo",
        price: "₹95,000 / night",
        rating: "4.9",
        popularity: "🔥 Zen minimalist sky sanctuary",
        checkout_time: "12:00 PM",
        checkout_details: "Settle room tablet logs. Direct limousine bus to Haneda/Narita."
      },
      {
        name: "Park Hyatt Tokyo",
        location: "Shinjuku, Tokyo",
        price: "₹65,000 / night",
        rating: "4.8",
        popularity: "👍 Landmark city skyline luxury",
        checkout_time: "12:00 PM",
        checkout_details: "Settle billing. Taxi standby assist. Free shuttle to Shinjuku Station."
      },
      {
        name: "Shibuya Granbell Hotel",
        location: "Sakuragaokacho, Shibuya",
        price: "₹14,000 / night",
        rating: "4.4",
        popularity: "🎨 Artistic stylish boutique right by Shibuya station",
        checkout_time: "11:00 AM",
        checkout_details: "Drop card at self-checkout machine. Quick automated process."
      },
      {
        name: "Hotel Gracery Shinjuku (Godzilla)",
        location: "Kabukicho, Tokyo",
        price: "₹18,000 / night",
        rating: "4.5",
        popularity: "🦖 Cyberpunk-view hotel with life-sized Godzilla Head",
        checkout_time: "11:00 AM",
        checkout_details: "Lobby kiosk checkout. Fast barcode scan."
      },
      {
        name: "Nine Hours Capsule Hotel Shinjuku",
        location: "Shinjuku, Tokyo",
        price: "₹3,500 / night",
        rating: "4.2",
        popularity: "🎒 Futuristic minimalist cyber capsule stay",
        checkout_time: "10:00 AM",
        checkout_details: "Return QR code wristband to standard desk. Lockers must be emptied."
      },
      {
        name: "Hoshinoya Tokyo Traditional Luxury",
        location: "Chiyoda, Tokyo",
        price: "₹75,000 / night",
        rating: "4.8",
        popularity: "🌿 Sustainable Ryokan Oasis with natural hot spring baths",
        checkout_time: "11:00 AM",
        checkout_details: "Handmade tatami check. Traditional checkout farewell ceremony."
      }
    ];

    toursList = [
      {
        title: "teamLab Planets Digital Art Immersive",
        price: "₹2,500",
        rating: "4.8",
        popularity: "🔥 Top Modern Digital Sensory Experience",
        location: "Toyosu, Tokyo"
      },
      {
        title: "Meiji Shrine & Harajuku Culture walking Tour",
        price: "₹1,000",
        rating: "4.6",
        popularity: "⛩️ Sacred cedar forests, Shinto gates & pop culture lanes",
        location: "Yoyogi Park, Tokyo"
      },
      {
        title: "Tsukiji Outer Market Street Food Tasting",
        price: "₹3,000",
        rating: "4.7",
        popularity: "🍣 Walk with local chef to sample fresh wagyu, sushi & tamago",
        location: "Tsukiji, Tokyo"
      },
      {
        title: "Tokyo Skytree Panoramic Observation Deck",
        price: "₹1,800",
        rating: "4.5",
        popularity: "🗼 Staggering high sky view on a clear day",
        location: "Sumida, Tokyo"
      },
      {
        title: "Akihabara Maid Cafe & Retro Gaming Tour",
        price: "₹1,500",
        rating: "4.4",
        popularity: "🎮 Geek culture, arcade history and cosplay centers",
        location: "Akihabara, Tokyo"
      },
      {
        title: "Mount Fuji & Hakone Scenic Mountain day Trip",
        price: "₹6,500",
        rating: "4.6",
        popularity: "🏔️ Bullet train, scenic ropeway and volcanic lake cruise",
        location: "Hakone / Mount Fuji"
      }
    ];

    restaurantsList = [
      {
        name: "Sukiyabashi Jiro (Ginza)",
        price: "₹32,000 for two",
        rating: "4.9",
        popularity: "🔥 World-Famous Michelin Chef Sushi Counter",
        distance: "4.5 km",
        duration: "15 mins",
        cuisine: "Ultra-Premium Sushi Omakase"
      },
      {
        name: "Ichiran Ramen Shinjuku",
        price: "₹1,600 for two",
        rating: "4.6",
        popularity: "🍜 Famous custom ramen bowls eaten in solo focused booths",
        distance: "0.4 km",
        duration: "2 mins walk",
        cuisine: "Tonkotsu / Veg Specialty Ramen"
      },
      {
        name: "Omoide Yokocho (Memory Lane Shinjuku)",
        price: "₹2,000 for two",
        rating: "4.4",
        popularity: "🍢 Smoky lantern-lit alleys serving classic grilled skewers",
        distance: "0.6 km",
        duration: "3 mins walk",
        cuisine: "Yakitori & Local Izakaya Small Plates"
      },
      {
        name: "Ninja Tokyo Restaurant (Akasaka)",
        price: "₹8,000 for two",
        rating: "4.3",
        popularity: "⚔️ Immersive themed fortress with magic trick servers",
        distance: "3.2 km",
        duration: "10 mins",
        cuisine: "Creative Japanese Modern Fusion"
      },
      {
        name: "Aoyama Flower Market Tea House",
        price: "₹1,500 for two",
        rating: "4.5",
        popularity: "🌸 Dining inside an active lush greenhouse tea parlor",
        distance: "5.1 km",
        duration: "14 mins",
        cuisine: "Organic Herbal Teas & Flowery Desserts"
      },
      {
        name: "New York Bar at Park Hyatt Tokyo",
        price: "₹6,000 for two",
        rating: "4.7",
        popularity: "🎺 Sky-high live jazz lounge with stunning night views",
        distance: "0.5 km",
        duration: "2 mins",
        cuisine: "Premium Steaks, Wines & Cocktails"
      }
    ];
  } else {
    // Dynamically customized generic city generator (provides 6 high-quality varied choices!)
    const city = destination || "Your Destination";
    forecastText = "Comfortable climate, moderate cloud cover";
    tempText = "24°C";
    narrativeText = `For your customized multi-day journey to ${city}, ANITA has generated 6 distinct, diverse options for accommodations, tours, and culinary spots. Instead of repeating the same choices across your itinerary, you have multiple price tiers and thematic routes to mix and match. Local listings are fully optimized to match your ${cuisinePref} preference and ${travelerType} traveler profile.`;
    
    hotelsList = [
      {
        name: `${city} Grand Palace Resort`,
        location: `Central Boulevard, ${city}`,
        price: "₹18,000 / night",
        rating: "4.8",
        popularity: "🔥 Top Tier Luxury & Spa Oasis",
        checkout_time: "12:00 PM",
        checkout_details: "Express digital check-out. Complimentary airport car transport."
      },
      {
        name: `The ${city} Heritage & Boutique Mansion`,
        location: `Old Town District, ${city}`,
        price: "₹6,500 / night",
        rating: "4.6",
        popularity: "👍 Highly-rated historic character property",
        checkout_time: "11:00 AM",
        checkout_details: "Lobby desk checkout. Traditional local gift given upon return of keys."
      },
      {
        name: `Urban Central Inn ${city}`,
        location: `Metro Junction, ${city}`,
        price: "₹3,800 / night",
        rating: "4.3",
        popularity: "🏢 Great Value & central accessibility",
        checkout_time: "11:00 AM",
        checkout_details: "Card-drop container checkout. Baggage hold available in room."
      },
      {
        name: `${city} Eco-Friendly Organic Retreat`,
        location: `Green Meadows, ${city}`,
        price: "₹8,200 / night",
        rating: "4.7",
        popularity: "🌿 Solar-powered sustainable sanctuary",
        checkout_time: "11:00 AM",
        checkout_details: "Eco-audit report print checkout. Electric taxi arranged on departure."
      },
      {
        name: `Backpackers Nest & Social Hostel`,
        location: `Artistic District, ${city}`,
        price: "₹1,200 / night",
        rating: "4.4",
        popularity: "🎒 Highly social budget-friendly backpackers",
        checkout_time: "10:00 AM",
        checkout_details: "Self-service cabinet checkout. Shared kitchen access post-key."
      },
      {
        name: `The ${city} Zenith Sky suites`,
        location: `Financial Harbor, ${city}`,
        price: "₹12,000 / night",
        rating: "4.5",
        popularity: "💻 Smart-automated ultra-modern highrise",
        checkout_time: "11:00 AM",
        checkout_details: "App-controlled automatic check-out. Smart lockers."
      }
    ];

    toursList = [
      {
        title: `Best of ${city} Private Guided Tour`,
        price: "₹1,800",
        rating: "4.7",
        popularity: "🔥 Essential sightseeing & city landmarks tour",
        location: `City Center, ${city}`
      },
      {
        title: "Historical Walking Tour & Old Town Secrets",
        price: "₹800",
        rating: "4.5",
        popularity: "🏛️ Deep-dive historical architecture and legends walk",
        location: `Historic District, ${city}`
      },
      {
        title: `Sunset Sailing & Photography Cruise`,
        price: "₹2,200",
        rating: "4.6",
        popularity: "⛵ Golden hour sailing with panoramic scenic photo ops",
        location: `Harbor Pier, ${city}`
      },
      {
        title: `${city} Nature & Forest Adventure Trail`,
        price: "₹1,500",
        rating: "4.6",
        popularity: "🌲 Active hiking trek with a certified eco-guide",
        location: `National Park Border, ${city}`
      },
      {
        title: "Culinary & Street Food Evening Food Crawl",
        price: "₹1,200",
        rating: "4.5",
        popularity: "🍲 Dynamic street tour sampling local savory secrets",
        location: `Local Food Market, ${city}`
      },
      {
        title: `${city} Modern Blueprints & Arts Walk`,
        price: "₹900",
        rating: "4.4",
        popularity: "🎨 Contemporary galleries, museum guides & street murals",
        location: `Creative Hub, ${city}`
      }
    ];

    restaurantsList = [
      {
        name: `The ${city} Gastronomy House`,
        price: "₹3,000 for two",
        rating: "4.7",
        popularity: "🔥 High-end culinary craftsmanship",
        distance: "2.8 km",
        duration: "8 mins",
        cuisine: `Premium Gourmet ${cuisinePref} Fusion`
      },
      {
        name: `Traditional ${city} Heritage Kitchen`,
        price: "₹1,400 for two",
        rating: "4.6",
        popularity: "🍛 Top local family legacy recipes spot",
        distance: "1.1 km",
        duration: "4 mins",
        cuisine: `Traditional Authentic ${cuisinePref} Platters`
      },
      {
        name: `The Hub Street Food Market`,
        price: "₹400 for two",
        rating: "4.5",
        popularity: "🍟 Busy open-air local street snacking",
        distance: "1.5 km",
        duration: "5 mins",
        cuisine: "Local Fast Snacks & Delicacies"
      },
      {
        name: `Green Earth Eco Cafe`,
        price: "₹800 for two",
        rating: "4.4",
        popularity: "🥗 Sustainable organic courtyard & smoothie bar",
        distance: "2.4 km",
        duration: "8 mins",
        cuisine: `Organic Healthy ${cuisinePref} & Gluten-Free`
      },
      {
        name: "Vista Panoramic Viewpoint Diner",
        price: "₹2,500 for two",
        rating: "4.6",
        popularity: "🌅 Spectacular sky views with outdoor terrace seating",
        distance: "5.5 km",
        duration: "15 mins",
        cuisine: `Scenic Multi-Cuisine ${cuisinePref} Grill`
      },
      {
        name: "The Hidden Bistro & Music Club",
        price: "₹1,800 for two",
        rating: "4.5",
        popularity: "🎷 Cozy underground local acoustic haunt",
        distance: "2.2 km",
        duration: "7 mins",
        cuisine: `Cozy Contemporary Bistro ${cuisinePref}`
      }
    ];
  }

  return {
    flight: {
      flights: [
        {
          airline: "IndiGo 6E-330",
          route: `${origin} → ${destination}`,
          price_range: "₹4,000",
          duration: "2h 15m",
          constraint_applied: "Direct departure morning flight optimized for early arrival."
        },
        {
          airline: "Air India AI-475",
          route: `${origin} → ${destination}`,
          price_range: "₹5,500",
          duration: "2h 30m",
          constraint_applied: "Premium Business comfort with meal services."
        },
        {
          airline: "Vistara UK-923",
          route: `${origin} → ${destination}`,
          price_range: "₹6,200",
          duration: "2h 20m",
          constraint_applied: "Afternoon premium option matching late itineraries."
        }
      ],
      return_flights: [
        {
          airline: "IndiGo 6E-512 (Return)",
          route: `${destination} → ${origin}`,
          price_range: "₹4,200",
          duration: "2h 10m",
          constraint_applied: "Afternoon Return (Departure: 15:30, after standard checkout)."
        },
        {
          airline: "Air India AI-478 (Return)",
          route: `${destination} → ${origin}`,
          price_range: "₹5,800",
          duration: "2h 20m",
          constraint_applied: "Late Evening Return (Departure: 19:45, ideal for full final day)."
        },
        {
          airline: "Vistara UK-926 (Return)",
          route: `${destination} → ${origin}`,
          price_range: "₹6,000",
          duration: "2h 15m",
          constraint_applied: "Late morning departure for early flight returns."
        }
      ]
    },
    hotel: {
      hotels: hotelsList
    },
    transport: {
      options: [
        {
          name: "Uber Outstation / Ola Private Cab",
          price: "₹1,500 / day",
          rating: "4.5",
          popularity: "🚕 Highly comfortable, fully on-demand air-conditioned",
          distance: "14 km",
          duration: "30 mins"
        },
        {
          name: "Local Electric E-Rickshaw / Autos",
          price: "₹150 / day",
          rating: "4.3",
          popularity: "🛺 Eco-friendly, highly popular for short heritage lanes",
          distance: "10 km",
          duration: "40 mins"
        },
        {
          name: "Fast Transit Metro Rail Service",
          price: "₹60 / day",
          rating: "4.4",
          popularity: "🚊 Bullet speed, avoids road congestion and traffic",
          distance: "15 km",
          duration: "20 mins"
        },
        {
          name: "City Explorer Bicycles / Scooter Rent",
          price: "₹300 / day",
          rating: "4.1",
          popularity: "🛵 Highly recommended for solo and adventure profiles",
          distance: "12 km",
          duration: "25 mins"
        }
      ]
    },
    tour: {
      tour_summary: {
        tours: toursList
      }
    },
    food: {
      restaurants: restaurantsList
    },
    impact_assessment: {
      sustainability: {
        carbon_score: travelerType === "adventure" ? "Low Carbon Offset" : "Moderate Carbon",
        eco_alternatives: [
          "Take local electric e-rickshaws or eco-metro to avoid combustion engine carbon emissions.",
          "Choose green eco-certified hotels utilizing solar thermal energy for hot water baths."
        ]
      },
      risk: {
        weather: `Predicted to be ${forecastText} at around ${tempText}. Clear flight pathways.`,
        political: "Completely safe zone; high tourist security coverage.",
        risk_level: travelerType === "solo" ? "Low-Medium (Stay alert in busy crowds)" : "Low (Family friendly)"
      },
      wellbeing: {
        activity_balance: "Paced beautifully with distinct cultural breaks and culinary rest intervals.",
        recommendation: "Allow a 2-hour rest during peak afternoon temperatures to avoid excessive fatigue."
      },
      cultural_fit: {
        sensitivity: "Dress modestly when visiting heritage shrines; remember to remove footwear.",
        dietary: `Outstanding ${cuisinePref} choices mapped securely across all 6 curated restaurants.`
      },
      budget: {
        flag: travelerType === "backpacker" ? "Moderate (Suggest Swaps)" : "Highly Optimized",
        alternatives: [
          "Swap top-luxury resorts with heritage boutique or backpacker properties to save over 70%.",
          "Use the fast transit metro or local electric rickshaws instead of private cabs to save ₹1,300 daily."
        ]
      },
      accessibility: {
        wheelchair_friendly_hotels: [
          "Top-tier luxury hotel options feature ramped entries and wide, spacious elevators."
        ],
        accessible_tours: [
          "Main landmark palaces offer accessible ground courtyards and dedicated mobility paths."
        ]
      },
      health: {
        altitude_risk: "None. Ground altitude levels are highly safe and standard.",
        vaccination_advisories: ["No mandatory vaccinations; carry oral rehydration salts and sunscreen."]
      },
      time_preferences: {
        morning_activities: [
          "Conduct grand landmark guided walks during early morning to beat crowd rushes and high sun peaks."
        ],
        evening_activities: [
          "Reserve local market exploring and candlelit rooftop dining for pleasant sunset hours."
        ]
      },
      group_dynamics: {
        shared_activities: [
          "Enjoy traditional group feasts or collaborative blue pottery pottery crafting."
        ],
        solo_activities: [
          "Spend calm hours strolling down local art galleries or colorful bazaar lanes."
        ]
      },
      alternates: {
        hotel: [hotelsList[1]?.name || "Heritage Boutique Hotel"],
        transport: ["Fast Transit Metro Rail Service"],
        tour: [toursList[2]?.title || "Scenic Sunset Photography Cruise"]
      }
    },
    impact_narrative: narrativeText,
    weather: {
      forecast: forecastText,
      temperature: tempText
    }
  };
}

// ---------------- API ENDPOINTS ----------------
app.post("/api/orchestrate", async (req, res) => {
  const { state, mode } = req.body;
  if (!state || !state.origin || !state.destination) {
    return res.status(400).json({ error: "Missing origin or destination in state." });
  }

  const { origin, destination, cuisine_preference, traveler_type, arrival_time, departure_time } = state;

  if (mode === "Demo") {
    const demoData = generateDemoData(origin, destination, cuisine_preference, traveler_type);
    return res.json({
      ...demoData,
      fromCache: true,
      cacheTimestamp: Date.now(),
      tokensSaved: 3250
    });
  }

  // Cache lookup
  const cacheKey = getCacheKey(origin, destination, cuisine_preference, traveler_type, arrival_time, departure_time);
  const cached = orchestrateCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp < 60 * 60 * 1000)) { // 1 hour TTL
    console.log(`[CACHE HIT] Returning cached orchestrated travel results for ${destination}`);
    return res.json({
      ...cached.data,
      fromCache: true,
      cacheTimestamp: cached.timestamp,
      tokensSaved: 3250
    });
  }

  try {
    const ai = getGeminiClient();

    const prompt = `You are ANITA, an advanced AI travel coordinator and orchestrator.
You need to generate an exceptionally rich, highly cohesive, detailed travel plan and impact report from ${origin} to ${destination}.
The traveler details are:
- Traveler Type / Profile: ${traveler_type}
- Cuisine Preference: ${cuisine_preference}
- Estimated Start/Departure: ${departure_time}
- Estimated Arrival/End: ${arrival_time}

To guarantee an outstanding user experience for planning multi-day trips, you MUST provide a large, highly diverse pool of options for hotels, tours, and dining. This allows the traveler to schedule distinct unique activities and meals for each day of their trip without repeating.

Please synthesize and include:
1. Flights between ${origin} and ${destination} (at least 3-4 options, including return flights)
2. At least 6 distinct Hotel accommodations in ${destination} (covering different price points: ultra-luxury, historic/heritage, boutique, eco-resorts, budget-friendly, and modern apartments)
3. At least 4 distinct Local transport options in ${destination} (private cabs, public transit, eco-rickshaws, metro, bikes, etc.)
4. At least 6 unique, highly varied Tours & Sightseeing activities in ${destination} (covering historical landmarks, museum tours, nature treks, sunset viewpoints, hidden gems, and interactive artisan classes)
5. At least 6 unique Culinary recommendations in ${destination} that match the cuisine preference "${cuisine_preference}" (ranging from local historic legends, fine dining, trendy cafes, street food markets, to scenic viewpoint restaurants)

Additionally, conduct an agent-based Impact Assessment evaluating:
- Sustainability (carbon score, eco-friendly recommendations)
- Risk & Safety (weather concerns, general safety, overall risk level)
- Wellbeing (pacing of activities, recommendations)
- Cultural & Social Fit (customs, dietary match)
- Budget Sensitivity (flag if expensive, provide cost-saving options)
- Accessibility needs (wheelchair/elevator support)
- Health considerations (altitude risk, hydration, vaccinations)
- Time Preferences (best morning vs evening suggestions)
- Group/Individual Dynamics (solo vs shared activities)
- Alternates (recommend alternative hotel, transport mode, and tours in case of flags)

Finally, provide a consolidated, cohesive 'impact_narrative' summarizing the assistant's perspective on this trip, and general weather info.

Return the results matching the requested JSON schema.`;

    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        flight: {
          type: Type.OBJECT,
          properties: {
            flights: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  airline: { type: Type.STRING },
                  route: { type: Type.STRING },
                  price_range: { type: Type.STRING },
                  duration: { type: Type.STRING },
                  constraint_applied: { type: Type.STRING }
                },
                required: ["airline", "route", "price_range"]
              }
            },
            return_flights: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  airline: { type: Type.STRING },
                  route: { type: Type.STRING },
                  price_range: { type: Type.STRING },
                  duration: { type: Type.STRING },
                  constraint_applied: { type: Type.STRING }
                },
                required: ["airline", "route", "price_range"]
              }
            }
          }
        },
        hotel: {
          type: Type.OBJECT,
          properties: {
            hotels: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  location: { type: Type.STRING },
                  price: { type: Type.STRING },
                  rating: { type: Type.STRING },
                  popularity: { type: Type.STRING },
                  checkout_time: { type: Type.STRING },
                  checkout_details: { type: Type.STRING }
                },
                required: ["name", "price", "rating"]
              }
            }
          }
        },
        transport: {
          type: Type.OBJECT,
          properties: {
            options: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  price: { type: Type.STRING },
                  rating: { type: Type.STRING },
                  popularity: { type: Type.STRING },
                  distance: { type: Type.STRING },
                  duration: { type: Type.STRING }
                },
                required: ["name", "price"]
              }
            }
          }
        },
        tour: {
          type: Type.OBJECT,
          properties: {
            tour_summary: {
              type: Type.OBJECT,
              properties: {
                tours: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      title: { type: Type.STRING },
                      price: { type: Type.STRING },
                      rating: { type: Type.STRING },
                      popularity: { type: Type.STRING },
                      location: { type: Type.STRING }
                    },
                    required: ["title", "price"]
                  }
                }
              }
            }
          }
        },
        food: {
          type: Type.OBJECT,
          properties: {
            restaurants: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  price: { type: Type.STRING },
                  rating: { type: Type.STRING },
                  popularity: { type: Type.STRING },
                  distance: { type: Type.STRING },
                  duration: { type: Type.STRING },
                  cuisine: { type: Type.STRING }
                },
                required: ["name", "price"]
              }
            }
          }
        },
        impact_assessment: {
          type: Type.OBJECT,
          properties: {
            sustainability: {
              type: Type.OBJECT,
              properties: {
                carbon_score: { type: Type.STRING },
                eco_alternatives: { type: Type.ARRAY, items: { type: Type.STRING } }
              }
            },
            risk: {
              type: Type.OBJECT,
              properties: {
                weather: { type: Type.STRING },
                political: { type: Type.STRING },
                risk_level: { type: Type.STRING }
              }
            },
            wellbeing: {
              type: Type.OBJECT,
              properties: {
                activity_balance: { type: Type.STRING },
                recommendation: { type: Type.STRING }
              }
            },
            cultural_fit: {
              type: Type.OBJECT,
              properties: {
                sensitivity: { type: Type.STRING },
                dietary: { type: Type.STRING }
              }
            },
            budget: {
              type: Type.OBJECT,
              properties: {
                flag: { type: Type.STRING },
                alternatives: { type: Type.ARRAY, items: { type: Type.STRING } }
              }
            },
            accessibility: {
              type: Type.OBJECT,
              properties: {
                wheelchair_friendly_hotels: { type: Type.ARRAY, items: { type: Type.STRING } },
                accessible_tours: { type: Type.ARRAY, items: { type: Type.STRING } }
              }
            },
            health: {
              type: Type.OBJECT,
              properties: {
                altitude_risk: { type: Type.STRING },
                vaccination_advisories: { type: Type.ARRAY, items: { type: Type.STRING } }
              }
            },
            time_preferences: {
              type: Type.OBJECT,
              properties: {
                morning_activities: { type: Type.ARRAY, items: { type: Type.STRING } },
                evening_activities: { type: Type.ARRAY, items: { type: Type.STRING } }
              }
            },
            group_dynamics: {
              type: Type.OBJECT,
              properties: {
                shared_activities: { type: Type.ARRAY, items: { type: Type.STRING } },
                solo_activities: { type: Type.ARRAY, items: { type: Type.STRING } }
              }
            },
            alternates: {
              type: Type.OBJECT,
              properties: {
                hotel: { type: Type.ARRAY, items: { type: Type.STRING } },
                transport: { type: Type.ARRAY, items: { type: Type.STRING } },
                tour: { type: Type.ARRAY, items: { type: Type.STRING } }
              }
            }
          }
        },
        impact_narrative: { type: Type.STRING },
        weather: {
          type: Type.OBJECT,
          properties: {
            forecast: { type: Type.STRING },
            temperature: { type: Type.STRING }
          }
        }
      }
    };

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema as any,
      },
    });

    const text = response.text;
    if (!text) {
      throw new Error("No response text from Gemini");
    }

    const resultData = JSON.parse(text);
    // Populate cache
    orchestrateCache.set(cacheKey, {
      data: resultData,
      timestamp: Date.now()
    });
    console.log(`[CACHE MISS] Populated orchestrated travel cache for key: ${cacheKey}`);
    
    return res.json({
      ...resultData,
      fromCache: false,
      cacheTimestamp: Date.now(),
      tokensSaved: 0
    });
  } catch (error: any) {
    console.warn("Gemini Orchestrate Error. Gracefully falling back to local swarm generation. Error:", error);
    try {
      const demoData = generateDemoData(origin, destination, cuisine_preference, traveler_type);
      const fallbackResult = {
        ...demoData,
        fromCache: true,
        cacheTimestamp: Date.now(),
        tokensSaved: 3250,
        isRateLimitedFallback: true
      };
      
      // Store in orchestrateCache to avoid hitting rate limit repeatedly
      orchestrateCache.set(cacheKey, {
        data: fallbackResult,
        timestamp: Date.now()
      });
      
      return res.json(fallbackResult);
    } catch (fallbackError) {
      console.error("Critical Orchestrate Fallback Failure:", fallbackError);
      return res.status(500).json({
        error: error.message || "An error occurred during travel orchestration.",
      });
    }
  }
});

function getMockVideosForDestination(destination: string) {
  const destClean = (destination || "").toLowerCase().trim();
  let mockVideos = [];
  if (destClean.includes("jaipur")) {
    mockVideos = [
      {
        title: "Jaipur Travel Guide - Best Places to Visit in Pink City",
        channel: "Toll Free Traveller",
        url: "https://www.youtube.com/watch?v=sObyhF8l9fE",
        duration: "15:45",
        description: "A comprehensive walk through Amer Fort, City Palace, Hawa Mahal and local lassi joints.",
        summary: "An outstanding guide walking through Jaipur's iconic monuments, explaining their historical significance and providing excellent local transport tips.",
        key_takeaways: [
          "Visit Amer Fort early in the morning (around 8:00 AM) to beat the massive tourist crowds and the intense midday desert heat.",
          "Buy a composite ticket at your first monument visit to save money on entry fees for multiple palaces across the city.",
          "Try the famous sweet lassi served in traditional earthen pots at Lassiwala on MI Road, open since 1944."
        ]
      },
      {
        title: "Jaipur Street Food Tour! Royal Rajasthani Thali & Spicy Kachori",
        channel: "Mark Wiens",
        url: "https://www.youtube.com/watch?v=Aof_OveYk0E",
        duration: "25:12",
        description: "Exploring Jaipur's rich culinary scene, from street side omelettes to traditional thalis at LMB.",
        summary: "An intensive culinary tour of Jaipur featuring traditional street food and a majestic, heavy Rajasthani Thali dining experience.",
        key_takeaways: [
          "Taste the Pyaaz Kachori (spicy onion pastry) at Rawat Mishtan Bhandar for an incredibly authentic local breakfast.",
          "Expect very rich, ghee-laden preparations in traditional thalis, so keep digestive remedies handy and pace yourself.",
          "Visit LMB (Laxmi Mishthan Bhandar) in Johri Bazar for the supreme royal thali dining experience in the old city."
        ]
      },
      {
        title: "Pink City Jaipur 3-Day Itinerary & Budget Guide",
        channel: "Tanya Khanijow",
        url: "https://www.youtube.com/watch?v=FjIto86m-0w",
        duration: "18:22",
        description: "Practical guide on visiting Jaipur, including Nahargarh fort cycle tours and local shopping secrets.",
        summary: "A complete 3-day travel blueprint for Jaipur focusing on beautiful photogenic locations, budget cafes, and local shopping secrets.",
        key_takeaways: [
          "Rent a cycle or book a guided walking tour of Nahargarh Fort at sunset for incredible panoramic views of the entire Pink City.",
          "Haggle extensively in Bapu Bazar and Johri Bazar; standard starting prices for textiles and handicrafts are usually 50% negotiable.",
          "Visit the Hawa Mahal (Palace of Winds) from the opposite rooftop cafes for the best photographic angle without the street noise."
        ]
      },
      {
        title: "Jaipur: Everything You Need to Know in 10 Minutes",
        channel: "Karl Rock",
        url: "https://www.youtube.com/watch?v=Kz6-8hO_j8k",
        duration: "10:14",
        description: "An insider safety, travel, scams and navigation guide for first-time visitors in Jaipur.",
        summary: "A fast-paced safety and navigation guide for first-time foreign and domestic travelers in Jaipur, exposing common scams and tourist traps.",
        key_takeaways: [
          "Ignore aggressive street vendors and tuk-tuk drivers offering 'free gemstone factory tours'—they are high-commission traps.",
          "Use Uber or Ola instead of unmetered local auto-rickshaws to ensure fair, transparent, and safe pricing.",
          "Beware of monkeys near Galta Ji (Monkey Temple); keep all food, sunglasses, and shiny objects packed away."
        ]
      }
    ];
  } else if (destClean.includes("goa")) {
    mockVideos = [
      {
        title: "Goa Travel Guide - North vs South Goa Comparison",
        channel: "Toll Free Traveller",
        url: "https://www.youtube.com/watch?v=8b06yis9I6k",
        duration: "12:30",
        description: "An honest breakdown of vibrant North Goa beaches versus tranquil South Goa nature trails.",
        summary: "A comprehensive comparison of Goa's regions, detailing the contrast between lively party spots in the north and serene nature in the south.",
        key_takeaways: [
          "Choose North Goa (Anjuna, Calangute, Vagator) if you want active nightlife, crowded beaches, and watersports.",
          "Stay in South Goa (Palolem, Agonda, Patnem) for pristine, quiet beaches, yoga retreats, and peaceful nature walks.",
          "Rent a scooter (approx. ₹300-₹500 per day) as it is the most economical and scenic way to commute across Goa."
        ]
      },
      {
        title: "Goa Street Food and Best Cafes! Crab Curry & Bebinca",
        channel: "Mark Wiens",
        url: "https://www.youtube.com/watch?v=1F5YV-rS000",
        duration: "22:15",
        description: "Sampling authentic coastal Goan food at Mum's Kitchen and Artjuna Garden Cafe.",
        summary: "A culinary exploration of coastal Goan cuisine, featuring fresh seafood, spicy vindaloo, and the traditional Portuguese-influenced Bebinca dessert.",
        key_takeaways: [
          "Try the authentic Goan Fish Thali at local joints like Ritz Classic in Panaji for a wholesome, budget-friendly meal.",
          "Indulge in Bebinca, a rich multi-layered traditional Goan dessert made with coconut milk and egg yolks.",
          "Visit garden cafes in Anjuna and Assagao for exceptional organic smoothies and continental breakfast options."
        ]
      },
      {
        title: "Offbeat Goa Guide - Waterfalls, Mangrove Kayaking & Spice Gardens",
        channel: "Kritika Goel",
        url: "https://www.youtube.com/watch?v=Xb03z7O32Yw",
        duration: "14:40",
        description: "A scenic travel vlog exploring backwater kayaking, Dudhsagar waterfalls, and Portuguese heritage quarters.",
        summary: "A beautiful scenic tour focusing on offbeat inland adventures in Goa, away from the typical beaches.",
        key_takeaways: [
          "Go kayaking in the dense mangroves of the Sal Backwaters early in the morning for serene birdwatching and calm waters.",
          "Take a guided walk through a spice plantation in Ponda, which usually includes a traditional buffet lunch and herbal tea.",
          "Plan a day trip to Dudhsagar Waterfalls but check seasonal access as trekking paths close during high monsoon."
        ]
      }
    ];
  } else if (destClean.includes("paris")) {
    mockVideos = [
      {
        title: "Paris Travel Guide - 10 Things to Do in Paris, France",
        channel: "Expoza Travel",
        url: "https://www.youtube.com/watch?v=34gP0X9eK6A",
        duration: "10:15",
        description: "Essential sightseeing guide covering the Eiffel Tower, Louvre Museum, and Seine River cruises.",
        summary: "An elegant tour of the must-see landmarks in Paris, offering premium advice on navigation and ticket booking strategies.",
        key_takeaways: [
          "Book Eiffel Tower and Louvre Museum tickets at least 1-2 months in advance to avoid 3-hour long queues.",
          "Take a sunset cruise along the Seine River for a magical view of the illuminated city monuments.",
          "Purchase a Navigo Decouverte weekly metro pass for cost-effective unlimited travel across the city zones."
        ]
      },
      {
        title: "Paris Street Food and Pastry Tour! Choux & Hot Chocolate",
        channel: "SweetGreenTravels",
        url: "https://www.youtube.com/watch?v=Xh0Y9Z7g0o0",
        duration: "18:35",
        description: "Indulging in world-famous pastries at Angelina Paris and falafels in Le Marais.",
        summary: "A decadent sweet and savory food tour through historic Parisian neighborhoods, highlighting top cafes and bakeries.",
        key_takeaways: [
          "Get the legendary hot chocolate and Mont-Blanc pastry at Angelina Paris, but prepare for a short queue.",
          "Visit the Marais district for world-class falafel from L'As du Fallafel, a perfect quick lunch option.",
          "Pick up fresh baguettes and croissants from local 'boulangeries' displaying the 'Artisan Boulanger' seal."
        ]
      },
      {
        title: "Paris Like a Local: Best Neighborhoods & Hidden Gems",
        channel: "Les Frenchies",
        url: "https://www.youtube.com/watch?v=gTsh5eL_O-0",
        duration: "14:12",
        description: "Discover local cafes, Montmartre shortcuts, and custom walking routes to skip the tourist traps.",
        summary: "An insider's walk exploring offbeat districts, local food markets, and secret shortcuts to avoid massive tourist crowds.",
        key_takeaways: [
          "Explore the charming, steep streets of Montmartre using side staircases instead of the crowded main funicular area.",
          "Spend a sunny afternoon picnicking at Canal Saint-Martin, a favorite hangout spot for Parisian youth.",
          "Download the 'Citymapper' app for real-time metro, bus, and walking route planning across Paris."
        ]
      }
    ];
  } else if (destClean.includes("tokyo")) {
    mockVideos = [
      {
        title: "Tokyo Japan Travel Guide - 3-Day Itinerary",
        channel: "Samuel and Audrey",
        url: "https://www.youtube.com/watch?v=420qX9_fGCo",
        duration: "20:05",
        description: "An immersive travel guide showing Shibuya Crossing, Harajuku culture, and teamLab digital art.",
        summary: "A detailed 3-day Tokyo itinerary covering neon-lit streets, historic temples, and cutting-edge interactive digital art installations.",
        key_takeaways: [
          "Visit teamLab Planets early in the day and wear easily removable shoes since several exhibits involve walking in water.",
          "Witness the Shibuya Crossing from the second-floor window of nearby cafes or the rooftop observatory.",
          "Stroll through Meiji Shrine in Harajuku early in the morning for a peaceful, meditative experience amidst giant cedar trees."
        ]
      },
      {
        title: "Tokyo Street Food Tour - Shinjuku Alleyways & Tsukiji Fish Market",
        channel: "Mark Wiens",
        url: "https://www.youtube.com/watch?v=Kz6-8hO_j8k",
        duration: "28:10",
        description: "Eating Tsukiji outer market fresh sushi and smoky yakitori in Omoide Yokocho.",
        summary: "An amazing gastronomic journey through traditional Tokyo markets and narrow nightlife alleys serving freshly grilled skewers.",
        key_takeaways: [
          "Tsukiji Outer Market is excellent for street snacks like tamagoyaki (sweet omelette) and fresh sea urchin.",
          "Head to Omoide Yokocho in Shinjuku for smoky, authentic yakitori skewers in a retro Post-War atmosphere.",
          "Always carry cash, as many traditional small-scale food stalls in Tokyo do not accept international credit cards."
        ]
      },
      {
        title: "How to Navigate the Tokyo Subway and Train System",
        channel: "Tokyo Llama",
        url: "https://www.youtube.com/watch?v=sObyhF8l9fE",
        duration: "12:55",
        description: "A stress-free tutorial on buying Suica cards, reading metro maps, and transfers.",
        summary: "A life-saving tutorial explaining the complex Tokyo transit network, ticketing apps, and navigation hacks.",
        key_takeaways: [
          "Load a digital Suica or Pasmo card directly into your phone's wallet app for seamless tap-to-ride access.",
          "Look at the platform floor markings which show exactly where train doors will open and where to queue.",
          "Note that different metro lines are owned by different companies; Google Maps is highly accurate for transfer details."
        ]
      }
    ];
  } else {
    mockVideos = [
      {
        title: `Discovering ${destination} - Ultimate Travel Guide & Itinerary`,
        channel: "GlobeTrotter",
        url: "https://www.youtube.com",
        duration: "15:00",
        description: `A beautiful walk through the best landmarks, scenic views, and local street culture in ${destination}.`,
        summary: `A comprehensive guide exploring the highlights, cultural heritage, and iconic sights of ${destination}.`,
        key_takeaways: [
          `Start your day early to capture beautiful morning light at major landmarks in ${destination}.`,
          `Use public transport or registered taxi apps to travel safely and avoid unregulated local transport rates.`,
          `Keep a physical map or download offline Google Maps of ${destination} to navigate without continuous network.`
        ]
      },
      {
        title: `Top 10 Things to Do in ${destination}`,
        channel: "Travel Buzz",
        url: "https://www.youtube.com",
        duration: "11:24",
        description: `Essential bucket list sightseeing and activities you cannot miss when visiting ${destination} for the first time.`,
        summary: `The absolute best sightseeing highlights and activities you must experience when traveling to ${destination}.`,
        key_takeaways: [
          `Check local museum and palace opening days, as many tourist sites are closed on Mondays or Tuesdays.`,
          `Wear comfortable walking shoes since exploring historic centers in ${destination} is best done on foot.`,
          `Book guided walking tours to learn about the hidden history and cultural legacy from registered local experts.`
        ]
      },
      {
        title: `Where to Eat in ${destination} - Local Food Guide`,
        channel: "Tasty Journeys",
        url: "https://www.youtube.com",
        duration: "19:40",
        description: `Sampling the most authentic culinary spots, secret cafes, and traditional heritage food joints in ${destination}.`,
        summary: `A tour of the best culinary spots, popular local street foods, and traditional cuisines in ${destination}.`,
        key_takeaways: [
          `Look for food stalls and eateries with long lines of local residents—this is the best indicator of quality and hygiene.`,
          `Ask locals or hotel staff for their favorite family-run dining spots instead of relying solely on tourist brochures.`,
          `Try the signature local specialty dish of ${destination}, which represents the authentic flavor of the region.`
        ]
      }
    ];
  }
  return mockVideos;
}

function getMockVisaForDestination(origin: string, destination: string) {
  const destClean = (destination || "").toLowerCase().trim();
  const originClean = (origin || "").toLowerCase().trim();

  let mockVisa = {
    requirementStatus: "eVisa / Visa on Arrival",
    validityRequired: "6 Months passport validity from date of arrival, with at least 2 blank pages.",
    documentsRequired: [
      "Valid International Passport",
      "Confirmed Return Flight Ticket",
      "Hotel Booking Proof / Reservation Voucher",
      "Recent Passport-size Photograph with white background",
      "Proof of sufficient funds (Credit card or cash statement)"
    ],
    feeEstimate: "₹2,500 - ₹4,000 (depending on express processing)",
    processingTime: "1 to 3 Business Days for eVisa",
    detailedSteps: [
      `Verify passport validity is at least 6 months before traveling from ${origin} to ${destination}.`,
      "Fill out the online application form with personal details and travel itinerary.",
      "Upload a scan of your passport bio page and recent photograph.",
      "Pay the processing fee securely via credit or debit card online.",
      "Receive the eVisa PDF via email, print a copy, and present it to immigration upon arrival."
    ],
    officialLinks: [
      { title: "Official Government eVisa Portal", url: "https://www.evisa.gov" },
      { title: "Consular Advisory and Travel Requirements", url: "https://www.consularadvisory.org" }
    ],
    importantNotes: "Double-check for any health declarations or localized vaccine certification requirements (e.g., Yellow Fever if arriving from specific zones)."
  };

  if (destClean.includes("jaipur") || destClean.includes("goa")) {
    mockVisa.requirementStatus = originClean.includes("bengaluru") || originClean.includes("delhi") || originClean.includes("mumbai")
      ? "Domestic - No Visa Required"
      : "Visa Required / eVisa";
    if (mockVisa.requirementStatus === "Domestic - No Visa Required") {
      mockVisa.validityRequired = "Government Photo ID (Aadhaar, Voter ID, or Passport) required for airport check-in.";
      mockVisa.documentsRequired = ["Aadhaar Card or Passport", "Aarogya Setu / Flight Boarding Pass"];
      mockVisa.feeEstimate = "Nil";
      mockVisa.processingTime = "Instant (No processing)";
      mockVisa.detailedSteps = [
        "Pack your standard government-issued photo identification.",
        "Check-in online 24 hours prior to departure.",
        "Present boarding pass and ID card at terminal entry."
      ];
      mockVisa.officialLinks = [
        { title: "DGCA India Travel Guidelines", url: "https://www.dgca.gov.in" }
      ];
      mockVisa.importantNotes = "No visa or special permits needed for Indian citizens traveling domestically.";
    }
  } else if (destClean.includes("paris")) {
    mockVisa.requirementStatus = "Schengen C-Type Visa Required";
    mockVisa.feeEstimate = "€80 (~₹7,200) plus VFS service fees";
    mockVisa.processingTime = "10 to 15 Business Days";
    mockVisa.documentsRequired.push("Travel Medical Insurance covering up to €30,000", "Detailed Day-by-Day travel itinerary booklet", "3 Years Income Tax Returns (ITR) or Form 16");
  } else if (destClean.includes("tokyo")) {
    mockVisa.requirementStatus = "eVisa / Single Entry Tourist Visa";
    mockVisa.feeEstimate = "₹500 for eVisa service fees";
    mockVisa.processingTime = "5 Business Days";
    mockVisa.documentsRequired.push("Certificate of Employment / Bank Balance certificate");
  }

  return mockVisa;
}

function getMockSimForDestination(destination: string) {
  const destClean = (destination || "").toLowerCase().trim();

  let mockSim = {
    operators: [
      {
        name: "Airalo eSIM",
        type: "eSIM Only (App-based)",
        bestTouristPlan: "20 GB Data for 30 Days (approx. $26)",
        pros: ["Instant download and activation before leaving home", "No need to swap physical cards", "Highly reliable LTE/5G local network bridging"],
        cons: ["No local phone number for incoming/outgoing regular calls", "Requires eSIM compatible smartphone"]
      },
      {
        name: "Airtel India Tourist SIM",
        type: "eSIM & Physical SIM",
        bestTouristPlan: "1.5 GB/day High Speed Data, Unlimited Calls, 28 Days (₹299)",
        pros: ["Excellent, widespread nationwide 5G coverage", "Includes local voice calling for cab/hotel coordination"],
        cons: ["Requires passport registration at airport or retail counter", "Activation can take 2 to 4 hours post purchase"]
      },
      {
        name: "Jio Tourist Pack",
        type: "Physical SIM / eSIM",
        bestTouristPlan: "2 GB/day High Speed 5G Data, 28 Days (₹349)",
        pros: ["Lightning fast True-5G network speed in major cities", "Extremely economical data bundles"],
        cons: ["Activation requires verified digital Aadhaar or passport KYC scans"]
      }
    ],
    airportAvailability: "Dedicated Airtel and Jio Kiosks are located directly outside the Customs Exit gate in the Arrival Terminal hall (Open 24/7).",
    activationProcess: "1. Purchase SIM at airport counter by presenting Passport and Passport-size photo.\n2. Fill out KYC digital registration form.\n3. Insert SIM card and wait for signal (approx. 2 hours).\n4. Dial tele-verification number (59059) and confirm passport details to activate.",
    recommendedChoice: "Airalo eSIM if your phone is compatible and you only need data; otherwise, a physical Airtel SIM purchased directly at the Airport Arrival Terminal is the safest bet for full phone coverage."
  };

  if (destClean.includes("paris")) {
    mockSim.operators = [
      {
        name: "Orange Holiday eSIM",
        type: "eSIM & Physical SIM",
        bestTouristPlan: "30 GB 5G Data, Unlimited Calls in Europe, 14 Days (€39.99)",
        pros: ["Comes with a French phone number", "No KYC registration needed", "Superfast 5G everywhere in France"],
        cons: ["Valid for only 14 days; needs topping up for longer trips"]
      },
      {
        name: "Bouygues My European SIM",
        type: "eSIM & Physical SIM",
        bestTouristPlan: "30 GB Data, €25 credit, 30 Days (€39.90)",
        pros: ["Longer validity duration", "Works seamlessly across Schengen countries"],
        cons: ["Slightly pricier than standard local SIM plans"]
      },
      {
        name: "Free Mobile Tourist SIM",
        type: "Physical SIM (Kiosk-based)",
        bestTouristPlan: "210 GB 5G Data, 30 Days (€29.99)",
        pros: ["Massive amount of 5G data", "Very budget friendly"],
        cons: ["Only purchasable from automated red vending machines in Free stores", "Does not support eSIM instantly"]
      }
    ];
    mockSim.airportAvailability = "Relay Stores and Tourist Information booths at Charles de Gaulle (CDG) and Orly (ORY) sell Orange Holiday packs. Avoid random currency exchange counters.";
    mockSim.activationProcess = "Orange Holiday SIMs are pre-activated. Simply pop the card in or scan the eSIM QR code. You will immediately connect to Orange network without complex steps.";
    mockSim.recommendedChoice = "Orange Holiday eSIM is highly recommended for ultimate comfort and European coverage with a phone number, while Free Mobile is best for budget data heavy users.";
  } else if (destClean.includes("tokyo")) {
    mockSim.operators = [
      {
        name: "Ubigi eSIM",
        type: "eSIM Only",
        bestTouristPlan: "10 GB 5G Data, 30 Days ($17)",
        pros: ["Uses NTT Docomo (Japan's best network)", "Extremely easy setup via App", "Very economical data rates"],
        cons: ["Data only, no phone number"]
      },
      {
        name: "Sakura Mobile SIM",
        type: "Physical SIM & eSIM",
        bestTouristPlan: "Unlimited Data, 15 Days (¥5,500 / approx. ₹3,000)",
        pros: ["True unlimited data with no throttling", "Full English support", "Pickup counters at all major airports"],
        cons: ["Very expensive compared to eSIM data packages"]
      }
    ];
    mockSim.airportAvailability = "Sim card rental counters (Sakura Mobile, Ninja SIM) are located at Narita (NRT) Terminals 1, 2, 3 and Haneda (HND) International terminal. Automated SIM vending machines are also open 24/7.";
    mockSim.activationProcess = "For eSIM, scan QR code and configure cellular profile. For Physical SIM, follow the APN settings profile manual included in the package (critical for Japan connectivity). No passport upload required for data-only SIMs.";
    mockSim.recommendedChoice = "Ubigi eSIM for compatible devices (Docomo network is superior). Sakura Mobile is recommended if you have a locked or non-eSIM device and require unlimited data.";
  }

  return mockSim;
}

// ---------------- YOUTUBE RAG ENDPOINT ----------------
app.post("/api/rag/youtube", async (req, res) => {
  const { destination, mode } = req.body;
  if (!destination) {
    return res.status(400).json({ error: "Missing destination for YouTube RAG." });
  }

  const destClean = destination.toLowerCase().trim();

  // If in Demo Mode or if the GEMINI_API_KEY is not defined, use high-quality mock data
  if (mode === "Demo" || !process.env.GEMINI_API_KEY) {
    const mockVideos = getMockVideosForDestination(destination);
    return res.json({ videos: mockVideos, fromCache: true });
  }

  // Live / Online mode with Search Grounding
  try {
    const ai = getGeminiClient();
    const prompt = `Search and list exactly 3-4 top high-quality YouTube travel guides or vlogs for visiting ${destination}. 
For each video, also provide a transcribed summary and an array of key transcribed insights or actionable suggestions as takeaways.
Return a valid JSON array of objects, each with:
- title: Video title
- channel: YouTube channel name
- url: A direct YouTube watch URL (like https://www.youtube.com/watch?v=...)
- description: Brief description of the video content and what it highlights
- duration: Video duration or date (e.g., '15:20' or '10 days ago')
- summary: A concise 2-3 sentence summarization of the video's transcript/guide insights.
- key_takeaways: An array of 3-4 highly specific, actionable travel suggestions, tips, or insights extracted from the video's transcript.

Make sure to find real YouTube links using Google Search. Return strictly valid JSON structure.`;

    const youtubeSchema = {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          channel: { type: Type.STRING },
          url: { type: Type.STRING },
          description: { type: Type.STRING },
          duration: { type: Type.STRING },
          summary: { type: Type.STRING },
          key_takeaways: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          }
        },
        required: ["title", "channel", "url", "summary", "key_takeaways"]
      }
    };

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: youtubeSchema as any
      }
    });

    const text = response.text;
    if (!text) throw new Error("No YouTube RAG results from Gemini");
    const parsed = JSON.parse(text);
    return res.json({ videos: parsed, fromCache: false });
  } catch (err: any) {
    console.warn("YouTube RAG Error, gracefully falling back to local simulation:", err);
    const mockVideos = getMockVideosForDestination(destination);
    return res.json({ videos: mockVideos, fromCache: true, isRateLimitedFallback: true });
  }
});

// ---------------- VISA RAG ENDPOINT ----------------
app.post("/api/rag/visa", async (req, res) => {
  const { origin, destination, mode } = req.body;
  if (!origin || !destination) {
    return res.status(400).json({ error: "Missing origin or destination for Visa RAG." });
  }

  const destClean = destination.toLowerCase().trim();
  const originClean = origin.toLowerCase().trim();

  if (mode === "Demo" || !process.env.GEMINI_API_KEY) {
    const mockVisa = getMockVisaForDestination(origin, destination);
    return res.json({ visa: mockVisa, fromCache: true });
  }

  // Live with Search Grounding
  try {
    const ai = getGeminiClient();
    const prompt = `Conduct a rigorous, up-to-date visa requirement and advisory audit for a traveler with a passport from country of origin "${origin}" visiting country of destination "${destination}".
Return a valid JSON object structure containing:
- requirementStatus: Short status (e.g. 'Visa Required', 'eVisa', 'Visa on Arrival', 'Visa Free')
- validityRequired: Passport validity length and specifications
- documentsRequired: Array of strings listing exact required documents
- feeEstimate: Estimated visa application cost in local currency or rupees
- processingTime: Typical processing time length
- detailedSteps: Array of strings showing chronological steps to apply
- officialLinks: Array of objects with 'title' and 'url' to official government or consular portals
- importantNotes: Critical travel warnings, guidelines, or advisory rules

Search and verify visa rules using Google Search grounding. Return strictly valid JSON structure.`;

    const visaSchema = {
      type: Type.OBJECT,
      properties: {
        requirementStatus: { type: Type.STRING },
        validityRequired: { type: Type.STRING },
        documentsRequired: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        },
        feeEstimate: { type: Type.STRING },
        processingTime: { type: Type.STRING },
        detailedSteps: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        },
        officialLinks: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              url: { type: Type.STRING }
            },
            required: ["title", "url"]
          }
        },
        importantNotes: { type: Type.STRING }
      },
      required: ["requirementStatus", "documentsRequired", "detailedSteps"]
    };

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: visaSchema as any
      }
    });

    const text = response.text;
    if (!text) throw new Error("No Visa RAG results from Gemini");
    const parsed = JSON.parse(text);
    return res.json({ visa: parsed, fromCache: false });
  } catch (err: any) {
    console.warn("Visa RAG Error, gracefully falling back to local simulation:", err);
    const mockVisa = getMockVisaForDestination(origin, destination);
    return res.json({ visa: mockVisa, fromCache: true, isRateLimitedFallback: true });
  }
});

// ---------------- SIM RAG ENDPOINT ----------------
app.post("/api/rag/sim", async (req, res) => {
  const { destination, mode } = req.body;
  if (!destination) {
    return res.status(400).json({ error: "Missing destination for SIM RAG." });
  }

  const destClean = destination.toLowerCase().trim();

  if (mode === "Demo" || !process.env.GEMINI_API_KEY) {
    const mockSim = getMockSimForDestination(destination);
    return res.json({ sim: mockSim, fromCache: true });
  }

  // Live with Search Grounding
  try {
    const ai = getGeminiClient();
    const prompt = `Search and retrieve the best tourist eSIM and physical SIM card mobile network plans, packages, and options for a tourist visiting "${destination}".
Return a valid JSON object structure containing:
- operators: Array of objects, each with:
  * name: Network name (e.g. Airtel, Orange, Docomo, Airalo)
  * type: eSIM, Physical SIM, or both
  * bestTouristPlan: Plan details, price, data/voice allowances
  * pros: Array of strings of pros
  * cons: Array of strings of cons
- airportAvailability: Details on where to buy tourist SIMs at major airports servicing "${destination}"
- activationProcess: Step-by-step guidelines to register and activate the SIM card
- recommendedChoice: Clear recommended choice depending on convenience/cost

Ground your search with Google Search grounding. Return strictly valid JSON structure.`;

    const simSchema = {
      type: Type.OBJECT,
      properties: {
        operators: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              type: { type: Type.STRING },
              bestTouristPlan: { type: Type.STRING },
              pros: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              },
              cons: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              }
            },
            required: ["name", "type", "bestTouristPlan"]
          }
        },
        airportAvailability: { type: Type.STRING },
        activationProcess: { type: Type.STRING },
        recommendedChoice: { type: Type.STRING }
      },
      required: ["operators", "recommendedChoice"]
    };

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: simSchema as any
      }
    });

    const text = response.text;
    if (!text) throw new Error("No SIM RAG results from Gemini");
    const parsed = JSON.parse(text);
    return res.json({ sim: parsed, fromCache: false });
  } catch (err: any) {
    console.warn("SIM RAG Error, gracefully falling back to local simulation:", err);
    const mockSim = getMockSimForDestination(destination);
    return res.json({ sim: mockSim, fromCache: true, isRateLimitedFallback: true });
  }
});

// ---------------- CONVERSATIONAL CHAT ENDPOINT ----------------
app.post("/api/chat", async (req, res) => {
  const { messages, state, mode } = req.body;
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: "Messages array is required." });
  }

  // Chat cache check
  const chatKey = JSON.stringify({ messages, state, mode });
  const cachedChat = chatCache.get(chatKey);
  if (cachedChat && (Date.now() - cachedChat.timestamp < 30 * 60 * 1000)) { // 30 mins TTL
    console.log("[CHAT CACHE HIT] Returning cached response");
    return res.json({
      reply: cachedChat.reply,
      fromCache: true,
      tokensSaved: 1200
    });
  }

  const isDemo = mode === "Demo";
  const hasKey = Boolean(process.env.GEMINI_API_KEY) && !isDemo;
  if (!hasKey) {
    // Return simulated response as a fallback
    const lastMsg = messages[messages.length - 1]?.content || "";
    const introText = isDemo
      ? `Hello! I'm ANITA, your travel swarm companion. Since we are in **Demo Mode**, I am providing direct simulated agent intelligence insights for your journey from **${state?.origin || "Bengaluru"}** to **${state?.destination || "Jaipur"}** as a **${state?.traveler_type || "general"}** traveler, ensuring 100% token efficiency!`
      : `Hello! I'm ANITA. I see you're discussing a trip from **${state?.origin || "Bengaluru"}** to **${state?.destination || "Jaipur"}** as a **${state?.traveler_type || "general"}** traveler. Since the GEMINI_API_KEY is not set yet in Secrets, I am responding in interactive simulation mode!`;
    
    let reply = introText;
    
    if (lastMsg.toLowerCase().includes("budget") || lastMsg.toLowerCase().includes("cost") || lastMsg.toLowerCase().includes("cheap")) {
      reply = `To help with your budget concern for the trip to **${state?.destination}**, our Budget Agent advises swapping standard cabs with the Jaipur Metro or local e-rickshaws. This will lower your daily transit budget from ₹1,500 to under ₹100!`;
    } else if (lastMsg.toLowerCase().includes("weather") || lastMsg.toLowerCase().includes("rain") || lastMsg.toLowerCase().includes("heat")) {
      reply = `Our Weather agent predicts clear skies but high UV peak indexes (around 36°C - 38°C). We recommend conducting fort treks early in the morning and allocating indoor museum visits or LMB thali lunch for peak heat (1 PM - 3 PM).`;
    } else if (lastMsg.toLowerCase().includes("sustain") || lastMsg.toLowerCase().includes("carbon") || lastMsg.toLowerCase().includes("eco")) {
      reply = `Our Sustainability agent indicates a moderate carbon footprint if flying. You can offset this by booking heritage boutique homestays that use solar water heaters and prioritizing local public transit/electric rickshaws.`;
    } else if (lastMsg.toLowerCase().includes("food") || lastMsg.toLowerCase().includes("cuisine") || lastMsg.toLowerCase().includes("eat")) {
      reply = `Based on your **${state?.cuisine_preference || "Any"}** culinary preference, our Food Agent recommends local icons like **Laxmi Misthan Bhandar (LMB)** for Rajasthani Thali, and **Chokhi Dhani** for an immersive cultural food village experience!`;
    } else {
      reply = `Understood! I am monitoring the simulated agent swarm (Flight, Hotel, Transit, Activity, Food) for your journey to **${state?.destination}**. Ask me about local weather alerts, carbon impact scores, wheelchair-friendly routes, or budgeting swaps!`;
    }

    // Cache simulation too
    chatCache.set(chatKey, { reply, timestamp: Date.now() });
    return res.json({ reply, fromCache: false, tokensSaved: 1200 });
  }

  try {
    const ai = getGeminiClient();
    const contents = messages.map(msg => ({
      role: msg.role === "user" ? "user" : "model",
      parts: [{ text: msg.content }]
    }));

    const systemPrompt = `You are ANITA (Agent-guided, Network-integrated Travel Advisory), an advanced AI travel coordinator and agent swarm orchestrator.
You help travelers optimize flights, accommodations, local transit, sightseeings, and culinary tours under strict budget, sustainability, and health metrics.
The user is currently considering a trip with these parameters:
- Origin: ${state?.origin || "Bengaluru"}
- Destination: ${state?.destination || "Jaipur"}
- Traveler profile: ${state?.traveler_type || "general"}
- Cuisine preference: ${state?.cuisine_preference || "Any"}

Keep your responses friendly, concise, and structured. Refer to the fact that you coordinate a swarm of specialized micro-agents (Flight agent, Hotel agent, Transit agent, Activity agent, Food agent) and can perform real-time sustainability / safety audits. Do not include markdown code block formatting for the whole response, just use standard bolding and lists.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: contents,
      config: {
        systemInstruction: systemPrompt,
      }
    });

    const reply = response.text || "I processed your request but have nothing to add.";
    chatCache.set(chatKey, { reply, timestamp: Date.now() });

    return res.json({ reply, fromCache: false, tokensSaved: 0 });
  } catch (error: any) {
    console.error("Gemini Chat Error:", error);
    return res.status(500).json({ error: error.message || "An error occurred during chat." });
  }
});

// ---------------- VITE MIDDLEWARE CONFIG ----------------
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
