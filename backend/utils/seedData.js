// Seeds demo data. Safe to re-run: it refuses to touch a non-empty database unless you pass --force.
//   npm run seed            -> only seeds an empty database
//   npm run seed -- --force -> wipes catalogue collections first (users are kept)
// Admin credentials come from SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD; if no password is set a random one is generated and printed ONCE.
const crypto = require("crypto");
const mongoose = require("mongoose");
const { env } = require("../config/env");
const connectDB = require("../config/database");
const User = require("../models/user.model");
const Destination = require("../models/destination.model");
const Hotel = require("../models/hotel.model");
const Room = require("../models/room.model");
const Package = require("../models/package.model");
const Coupon = require("../models/coupon.model");

const A = (name, area, categories, estimatedCost = 0, timeOfDay = "any", durationHours = 3, description = "") => ({ name, area, categories, estimatedCost, timeOfDay, durationHours, description });
const inDays = (n) => new Date(Date.now() + n * 24 * 60 * 60 * 1000);
const monthlyDepartures = (count = 6, first = 21, gap = 14) => Array.from({ length: count }, (_, i) => inDays(first + i * gap));

const destinationsData = [
  {
    name: "Kashmir Valley", state: "Jammu & Kashmir", city: "Srinagar", tags: ["Hill Station", "Nature", "Adventure"], bestTimeToVisit: "April to October (Gulmarg skiing: December to March)",
    description: "Snow-capped peaks, Dal Lake houseboats, Mughal gardens and alpine meadows - the 'Paradise on Earth'.",
    coordinates: { lat: 34.0837, lng: 74.7973 },
    areas: ["Srinagar", "Gulmarg", "Pahalgam", "Sonamarg"],
    costPerDay: { budget: 2200, standard: 4200, luxury: 8500 },
    attractions: [
      A("Dal Lake Shikara ride", "Srinagar", ["Nature", "Relaxation"], 800, "evening", 2, "Sunset ride past floating gardens and houseboats."),
      A("Mughal Gardens (Nishat & Shalimar)", "Srinagar", ["Culture", "Nature", "Heritage"], 50, "morning", 3),
      A("Shankaracharya Temple", "Srinagar", ["Spiritual", "Culture"], 0, "morning", 2),
      A("Old City & Jamia Masjid walk", "Srinagar", ["Culture", "Heritage", "Food"], 0, "afternoon", 3),
      A("Gulmarg Gondola (Phase 1 & 2)", "Gulmarg", ["Adventure", "Nature"], 1800, "morning", 3, "One of the highest cable cars in the world."),
      A("Apharwat Peak trek", "Gulmarg", ["Adventure"], 0, "any", 5),
      A("Alpather Lake viewpoint", "Gulmarg", ["Nature"], 0, "afternoon", 3),
      A("Betaab Valley", "Pahalgam", ["Nature", "Relaxation"], 300, "morning", 3),
      A("Lidder River rafting", "Pahalgam", ["Adventure"], 1500, "any", 3),
      A("Aru Valley pony trek", "Pahalgam", ["Nature", "Adventure"], 600, "afternoon", 4),
      A("Thajiwas Glacier", "Sonamarg", ["Nature", "Adventure"], 1200, "morning", 4),
      A("Zojila Pass drive", "Sonamarg", ["Adventure", "Nature"], 0, "afternoon", 3),
      A("Baltal Valley picnic", "Sonamarg", ["Nature", "Relaxation"], 0, "any", 2),
    ],
  },
  {
    name: "Ladakh", state: "Ladakh", city: "Leh", tags: ["Adventure", "Nature", "Spiritual"], bestTimeToVisit: "June to September",
    description: "High-altitude desert of monasteries, turquoise lakes and the world's highest motorable passes.",
    coordinates: { lat: 34.1526, lng: 77.5771 },
    areas: ["Leh", "Nubra Valley", "Pangong"],
    costPerDay: { budget: 2500, standard: 4800, luxury: 9500 },
    attractions: [
      A("Leh Palace & Shanti Stupa", "Leh", ["Heritage", "Spiritual"], 100, "morning", 3),
      A("Thiksey & Hemis monasteries", "Leh", ["Spiritual", "Culture"], 100, "afternoon", 4),
      A("Magnetic Hill & Sangam", "Leh", ["Nature"], 0, "afternoon", 3),
      A("Khardung La & Hunder dunes", "Nubra Valley", ["Adventure", "Nature"], 800, "morning", 6),
      A("Bactrian camel ride", "Nubra Valley", ["Adventure", "Culture"], 500, "evening", 1),
      A("Pangong Lake sunrise", "Pangong", ["Nature", "Relaxation"], 0, "morning", 4),
    ],
  },
  {
    name: "Jaipur - The Pink City", state: "Rajasthan", city: "Jaipur", tags: ["Heritage", "Culture"], bestTimeToVisit: "October to March",
    description: "Forts, palaces and bazaars painted in terracotta pink - the gateway to royal Rajasthan.",
    coordinates: { lat: 26.9124, lng: 75.7873 },
    areas: ["Jaipur"],
    costPerDay: { budget: 1800, standard: 3500, luxury: 7500 },
    attractions: [
      A("Amber Fort", "Jaipur", ["Heritage", "Culture"], 500, "morning", 3), A("City Palace", "Jaipur", ["Heritage", "Culture"], 700, "afternoon", 2),
      A("Hawa Mahal", "Jaipur", ["Heritage"], 200, "morning", 1), A("Jantar Mantar", "Jaipur", ["Heritage", "Culture"], 200, "any", 2),
      A("Chokhi Dhani dinner", "Jaipur", ["Food", "Culture"], 900, "evening", 3), A("Johari Bazaar shopping", "Jaipur", ["Shopping", "Food"], 0, "evening", 2),
    ],
  },
  {
    name: "Kerala Backwaters", state: "Kerala", city: "Alleppey", tags: ["Backwaters", "Nature", "Relaxation"], bestTimeToVisit: "September to March",
    description: "Houseboats, coconut lagoons, spice hills and Ayurvedic retreats.",
    coordinates: { lat: 9.4981, lng: 76.3388 },
    areas: ["Kochi", "Munnar", "Alleppey"],
    costPerDay: { budget: 2000, standard: 3800, luxury: 8000 },
    attractions: [
      A("Fort Kochi walk & Chinese nets", "Kochi", ["Heritage", "Culture", "Food"], 0, "afternoon", 3), A("Kathakali show", "Kochi", ["Culture"], 400, "evening", 2),
      A("Tea garden & Eravikulam NP", "Munnar", ["Nature", "Adventure"], 300, "morning", 4), A("Spice plantation tour", "Munnar", ["Nature", "Food"], 250, "afternoon", 2),
      A("Houseboat cruise", "Alleppey", ["Relaxation", "Nature"], 3500, "any", 8), A("Ayurvedic massage", "Alleppey", ["Relaxation"], 1500, "evening", 2),
    ],
  },
  {
    name: "Goa Beaches", state: "Goa", city: "Panaji", tags: ["Beach", "Nightlife"], bestTimeToVisit: "November to February",
    description: "Sun, sand, Portuguese heritage and legendary beach shacks.",
    coordinates: { lat: 15.4909, lng: 73.8278 },
    areas: ["North Goa", "South Goa"],
    costPerDay: { budget: 2000, standard: 4000, luxury: 8500 },
    attractions: [
      A("Baga & Calangute beaches", "North Goa", ["Relaxation", "Adventure"], 1200, "afternoon", 4), A("Fort Aguada sunset", "North Goa", ["Heritage", "Nature"], 0, "evening", 2),
      A("Old Goa churches", "South Goa", ["Heritage", "Spiritual"], 0, "morning", 3), A("Palolem beach & kayaking", "South Goa", ["Nature", "Adventure"], 600, "any", 4),
    ],
  },
  {
    name: "Manali - Himalayan Retreat", state: "Himachal Pradesh", city: "Manali", tags: ["Hill Station", "Adventure"], bestTimeToVisit: "March to June, December to February",
    description: "Pine forests, snow passes and the best adventure sports in the Himalayas.",
    coordinates: { lat: 32.2396, lng: 77.1887 },
    areas: ["Manali", "Solang", "Kasol"],
    costPerDay: { budget: 1900, standard: 3600, luxury: 7800 },
    attractions: [
      A("Hadimba Temple & Old Manali", "Manali", ["Spiritual", "Culture", "Food"], 0, "morning", 3), A("Solang Valley paragliding", "Solang", ["Adventure"], 2500, "morning", 3),
      A("Atal Tunnel & Sissu", "Solang", ["Nature", "Adventure"], 0, "afternoon", 4), A("Kasol & Parvati valley trek", "Kasol", ["Nature", "Adventure"], 400, "any", 6),
    ],
  },
];

const hotelsFor = (byName) => [
  { dest: "Kashmir Valley", hotel: { name: "Dal Lake Heritage Houseboat", hotelType: "Heritage", description: "Hand-carved cedar houseboat floating on Dal Lake.", location: { address: "Boulevard Road, Dal Lake", city: "Srinagar", state: "Jammu & Kashmir", country: "India" }, amenities: ["Breakfast", "WiFi", "Shikara Transfer"], rating: 4.5 }, rooms: [{ roomType: "Deluxe", price: 5500, capacity: 2, totalRooms: 6 }, { roomType: "Suite", price: 9500, capacity: 4, totalRooms: 2 }] },
  { dest: "Kashmir Valley", hotel: { name: "Gulmarg Snow Lodge", hotelType: "Resort", description: "Ski-in resort at the foot of the Gondola.", location: { address: "Gulmarg Main Road", city: "Gulmarg", state: "Jammu & Kashmir", country: "India" }, amenities: ["Heating", "Breakfast", "Parking", "Spa"], rating: 4.3 }, rooms: [{ roomType: "Double", price: 6200, capacity: 2, totalRooms: 10 }] },
  { dest: "Jaipur - The Pink City", hotel: { name: "Rambagh Heritage Palace", hotelType: "Heritage", description: "A former royal residence turned luxury hotel.", location: { address: "Bhawani Singh Road", city: "Jaipur", state: "Rajasthan", country: "India" }, amenities: ["Pool", "Spa", "WiFi", "Breakfast"], rating: 4.7 }, rooms: [{ roomType: "Deluxe", price: 12000, capacity: 2, totalRooms: 8 }, { roomType: "Suite", price: 24000, capacity: 3, totalRooms: 3 }] },
  { dest: "Kerala Backwaters", hotel: { name: "Backwater Bliss Resort", hotelType: "Resort", description: "Lakeside cottages with private jetty.", location: { address: "Punnamada Lake Road", city: "Alleppey", state: "Kerala", country: "India" }, amenities: ["Pool", "Ayurveda Spa", "WiFi", "Breakfast"], rating: 4.4 }, rooms: [{ roomType: "Double", price: 6500, capacity: 2, totalRooms: 12 }] },
  { dest: "Goa Beaches", hotel: { name: "Sunset Sands Beach Resort", hotelType: "Resort", description: "Beachfront resort steps from the water.", location: { address: "Calangute Beach Road", city: "Panaji", state: "Goa", country: "India" }, amenities: ["Pool", "Beach Access", "WiFi", "Bar"], rating: 4.1 }, rooms: [{ roomType: "Double", price: 4800, capacity: 2, totalRooms: 15 }, { roomType: "Family", price: 7800, capacity: 4, totalRooms: 5 }] },
  { dest: "Manali - Himalayan Retreat", hotel: { name: "Snowline Mountain Lodge", hotelType: "Boutique", description: "Pine-wood lodge with valley views.", location: { address: "Old Manali Road", city: "Manali", state: "Himachal Pradesh", country: "India" }, amenities: ["Heating", "Bonfire", "WiFi", "Breakfast"], rating: 4.2 }, rooms: [{ roomType: "Double", price: 3800, capacity: 2, totalRooms: 10 }] },
].map((h) => ({ ...h, destination: byName[h.dest] }));

const seed = async () => {
  await connectDB();
  const force = process.argv.includes("--force");

  if (!force && (await Destination.estimatedDocumentCount()) > 0) {
    console.log("Database already has data - nothing seeded. Use `npm run seed -- --force` to wipe catalogue data and reseed.");
    return;
  }
  if (force) {
    if (env.isProd) throw new Error("Refusing to --force seed in production");
    await Promise.all([Destination.deleteMany(), Hotel.deleteMany(), Room.deleteMany(), Package.deleteMany(), Coupon.deleteMany()]);
  }

  // ---- admin user ----
  const email = (process.env.SEED_ADMIN_EMAIL || "admin@indiatravel.com").toLowerCase();
  let admin = await User.findOne({ email });
  if (!admin) {
    const password = process.env.SEED_ADMIN_PASSWORD || `${crypto.randomBytes(9).toString("base64url")}9a`;
    admin = await User.create({ name: "Admin", email, password, role: "admin", isEmailVerified: true });
    console.log(`\nCreated admin  ${email}${process.env.SEED_ADMIN_PASSWORD ? "" : `\n  generated password: ${password}  (shown once - change it after first login)`}\n`);
  }

  // ---- catalogue ----
  const destinations = await Destination.insertMany(destinationsData.map((d) => ({ ...d, createdBy: admin._id })));
  const byName = Object.fromEntries(destinations.map((d) => [d.name, d._id]));

  const hotelIds = {};
  for (const { hotel, rooms, destination } of hotelsFor(byName)) {
    const h = await Hotel.create({ ...hotel, destination, createdBy: admin._id });
    hotelIds[hotel.name] = h._id;
    await Room.insertMany(rooms.map((r) => ({ ...r, hotel: h._id })));
  }

  await Package.insertMany([
    { name: "Kashmir Paradise Tour", destination: byName["Kashmir Valley"], packageType: "Adventure", duration: { days: 6, nights: 5 }, price: 24500, maxGroupSize: 12, rating: 0, startDates: monthlyDepartures(8, 14, 10), hotels: [hotelIds["Dal Lake Heritage Houseboat"], hotelIds["Gulmarg Snow Lodge"]], amenities: ["Meals", "Airport Transfer", "Guide", "Shikara Ride"], included: ["Stay on houseboat + resort", "Breakfast & dinner", "Private cab", "Gondola ticket"], excluded: ["Flights", "Lunch", "Personal expenses"], description: "Srinagar, Gulmarg, Pahalgam and Sonamarg in six unforgettable days.", itinerary: [{ day: 1, title: "Arrive Srinagar", description: "Houseboat check-in and sunset Shikara." }, { day: 2, title: "Gulmarg", description: "Gondola and meadows." }, { day: 3, title: "Pahalgam", description: "Betaab and Aru valleys." }, { day: 4, title: "Sonamarg", description: "Thajiwas glacier." }, { day: 5, title: "Srinagar gardens", description: "Mughal gardens and old city." }, { day: 6, title: "Departure", description: "Airport drop." }], createdBy: admin._id },
    { name: "Kashmir Honeymoon Special", destination: byName["Kashmir Valley"], packageType: "Honeymoon", duration: { days: 5, nights: 4 }, price: 31000, maxGroupSize: 8, startDates: monthlyDepartures(6, 20, 14), hotels: [hotelIds["Dal Lake Heritage Houseboat"]], amenities: ["Meals", "Candlelight Dinner", "Airport Transfer"], included: ["Deluxe houseboat", "All meals", "Private cab"], excluded: ["Flights"], description: "Romantic five days on Dal Lake and in the meadows of Gulmarg.", itinerary: [], createdBy: admin._id },
    { name: "Ladakh Explorer", destination: byName["Ladakh"], packageType: "Adventure", duration: { days: 7, nights: 6 }, price: 38000, maxGroupSize: 10, startDates: monthlyDepartures(6, 30, 12), amenities: ["Meals", "Oxygen Support", "Guide"], included: ["Camps & hotels", "Meals", "Inner-line permits"], excluded: ["Flights"], description: "Leh, Nubra and Pangong in a week.", itinerary: [], createdBy: admin._id },
    { name: "Golden Triangle Classic", destination: byName["Jaipur - The Pink City"], packageType: "Cultural", duration: { days: 5, nights: 4 }, price: 18500, maxGroupSize: 15, startDates: monthlyDepartures(6, 10, 7), hotels: [hotelIds["Rambagh Heritage Palace"]], amenities: ["Breakfast", "Guide", "AC Transport"], included: ["Hotels", "Breakfast", "Guide"], excluded: ["Flights"], description: "Delhi - Agra - Jaipur highlights.", itinerary: [], createdBy: admin._id },
    { name: "Kerala Backwater Bliss", destination: byName["Kerala Backwaters"], packageType: "Honeymoon", duration: { days: 6, nights: 5 }, price: 22000, maxGroupSize: 10, startDates: monthlyDepartures(6, 12, 10), hotels: [hotelIds["Backwater Bliss Resort"]], amenities: ["Houseboat", "Meals", "Ayurveda"], included: ["Houseboat night", "Resort stay", "Meals"], excluded: ["Flights"], description: "Kochi, Munnar and Alleppey.", itinerary: [], createdBy: admin._id },
    { name: "Himalayan Adventure", destination: byName["Manali - Himalayan Retreat"], packageType: "Adventure", duration: { days: 5, nights: 4 }, price: 15500, maxGroupSize: 14, startDates: monthlyDepartures(6, 9, 8), hotels: [hotelIds["Snowline Mountain Lodge"]], amenities: ["Breakfast", "Adventure Activities"], included: ["Stay", "Paragliding", "Rafting"], excluded: ["Lunch"], description: "Paragliding, rafting and trekking around Manali.", itinerary: [], createdBy: admin._id },
  ]);

  // ---- coupons ----
  const nextYear = inDays(365);
  await Coupon.insertMany([
    { code: "WELCOME10", description: "10% off your first booking", discountType: "percentage", discountValue: 10, minPurchaseAmount: 5000, maxDiscountAmount: 10000, expiryDate: nextYear, usageLimit: 1000, perUserLimit: 1, createdBy: admin._id },
    { code: "TRAVEL500", description: "Flat Rs.500 off", discountType: "flat", discountValue: 500, minPurchaseAmount: 3000, expiryDate: nextYear, usageLimit: 500, perUserLimit: 2, createdBy: admin._id },
    { code: "DIWALI20", description: "Festive 20% off packages", discountType: "percentage", discountValue: 20, minPurchaseAmount: 15000, maxDiscountAmount: 8000, applicableOn: "package", expiryDate: nextYear, usageLimit: 200, perUserLimit: 1, createdBy: admin._id },
  ]);

  console.log(`Seeded ${destinations.length} destinations, ${Object.keys(hotelIds).length} hotels, 6 packages and 3 coupons.`);
};

seed()
  .catch((err) => {
    console.error("Seed failed:", err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.connection.close();
  });
