// Travel Itinerary Engine
// -----------------------
// Turns "5 days Kashmir, Rs.40,000, Adventure + Nature" into a day-by-day plan that actually fits the budget.
// It is deterministic and rule-based (no AI needed): attractions are scored by how well they match the traveller's
// interests, areas are visited in the destination's natural circuit order starting/ending at the arrival hub,
// and optional paid activities are dropped (lowest score first) until the trip fits the budget.
// Output also links to REAL bookable packages + hotels so the plan can be turned into a booking.

const Destination = require("../models/destination.model");
const Package = require("../models/package.model");
const Hotel = require("../models/hotel.model");
const { cheapestRoomPrices } = require("../utils/roomPrices");
const mongoose = require("mongoose");
const { httpError } = require("../utils/httpError");
const { safeRegex } = require("../utils/escapeRegex");

const PACE = { relaxed: 1, balanced: 2, packed: 3 };
const TIME_ORDER = { morning: 0, any: 1, afternoon: 2, evening: 3 };
const TIERS = ["luxury", "standard", "budget"]; // best -> cheapest

const norm = (s) => String(s || "").trim().toLowerCase();

/* ---------------- pure engine ---------------- */

const scoreAttraction = (a, interests) => {
  if (!interests.length) return 1;
  const cats = (a.categories || []).map(norm);
  const matches = interests.filter((i) => cats.includes(i)).length;
  return matches ? 3 * matches : 0.5; // non-matching places stay available as filler
};

const resolveAreas = (destination) => {
  let areas = (destination.areas || []).filter(Boolean);
  if (!areas.length) {
    const seen = [];
    (destination.attractions || []).forEach((a) => a.area && !seen.includes(a.area) && seen.push(a.area));
    areas = seen;
  }
  if (!areas.length) areas = [destination.city || destination.name];
  return areas;
};

/**
 * @param {object} p
 * @param {object} p.destination  { name, city, areas[], attractions[], costPerDay{budget,standard,luxury}, bestTimeToVisit }
 * @param {number} p.days         1..15
 * @param {number} p.budget       total budget in INR for the whole group
 * @param {number} [p.travellers]
 * @param {string[]} [p.interests]
 * @param {"relaxed"|"balanced"|"packed"} [p.pace]
 */
const buildItinerary = ({ destination, days, budget, travellers = 1, interests = [], pace = "balanced" }) => {
  const want = interests.map(norm).filter(Boolean);
  const perDay = PACE[pace] || 2;
  const areas = resolveAreas(destination);
  const hub = areas[0];
  const cpd = { budget: 1800, standard: 3500, luxury: 7500, ...(destination.costPerDay?.toObject?.() || destination.costPerDay || {}) };

  // 1. score + group attractions by area
  const pool = (destination.attractions || []).map((a) => {
    const o = a.toObject ? a.toObject() : a;
    return { ...o, area: o.area || hub, score: scoreAttraction(o, want) };
  });
  const byArea = new Map(areas.map((a) => [a, []]));
  pool.forEach((a) => {
    if (!byArea.has(a.area)) byArea.set(a.area, []);
    byArea.get(a.area).push(a);
  });
  byArea.forEach((list) => list.sort((x, y) => y.score - x.score || x.estimatedCost - y.estimatedCost));

  const areaScore = (area) => (byArea.get(area) || []).slice(0, perDay * 2).reduce((s, a) => s + a.score, 0);

  // 2. decide which area each day is spent in
  const nonHub = areas.slice(1).filter((a) => (byArea.get(a) || []).length);
  let dayAreas;
  if (days === 1) {
    dayAreas = [hub];
  } else if (days === 2) {
    const best = [...nonHub].sort((a, b) => areaScore(b) - areaScore(a))[0];
    dayAreas = [hub, best || hub];
  } else {
    const middle = days - 2;
    const ranked = [...nonHub].sort((a, b) => areaScore(b) - areaScore(a));
    const chosen = ranked.slice(0, middle);
    // extra days: give a second day to areas with enough unseen attractions, best first
    const stays = new Map(chosen.map((a) => [a, 1]));
    let spare = middle - chosen.length;
    while (spare > 0 && chosen.length) {
      const candidate = [...chosen]
        .filter((a) => (byArea.get(a) || []).length > stays.get(a) * perDay)
        .sort((a, b) => areaScore(b) / stays.get(b) - areaScore(a) / stays.get(a))[0];
      if (!candidate) break;
      stays.set(candidate, stays.get(candidate) + 1);
      spare--;
    }
    const circuit = chosen.sort((a, b) => areas.indexOf(a) - areas.indexOf(b));
    const middleDays = circuit.flatMap((a) => Array(stays.get(a)).fill(a));
    while (middleDays.length < middle) middleDays.push(hub); // nothing left to see -> relaxed local day
    dayAreas = [hub, ...middleDays, hub];
  }

  // 3. pick activities for each day
  const used = new Set();
  const take = (area, n, maxHours = 9) => {
    const picked = [];
    let hours = 0;
    for (const a of byArea.get(area) || []) {
      if (used.has(a)) continue;
      if (picked.length >= n) break;
      if (picked.length && hours + a.durationHours > maxHours) continue;
      picked.push(a);
      used.add(a);
      hours += a.durationHours;
    }
    return picked.sort((x, y) => TIME_ORDER[x.timeOfDay || "any"] - TIME_ORDER[y.timeOfDay || "any"]);
  };

  const plan = dayAreas.map((area, i) => {
    const isArrival = i === 0 && days > 1;
    const isDeparture = i === days - 1 && days > 1;
    const slots = isArrival || isDeparture ? Math.max(1, perDay - 1) : perDay; // lighter travel days
    return { day: i + 1, area, isArrival, isDeparture, activities: take(area, slots, isArrival || isDeparture ? 5 : 9) };
  });

  // 4. fit the budget: choose the richest tier we can afford; if even "budget" is too expensive drop paid extras
  const activityCost = () => plan.reduce((s, d) => s + d.activities.reduce((x, a) => x + (a.estimatedCost || 0) * travellers, 0), 0);
  const baseCost = (tier) => cpd[tier] * days * travellers;
  const chooseTier = () => TIERS.find((t) => baseCost(t) + activityCost() <= budget);

  let tier = chooseTier();
  const dropped = [];
  while (!tier) {
    const paid = plan.flatMap((d) => d.activities.map((a) => ({ d, a }))).filter(({ a }) => a.estimatedCost > 0);
    if (!paid.length) break;
    paid.sort((x, y) => x.a.score - y.a.score || y.a.estimatedCost - x.a.estimatedCost);
    const { d, a } = paid[0];
    d.activities = d.activities.filter((x) => x !== a);
    dropped.push(a.name);
    tier = chooseTier();
  }
  const withinBudget = Boolean(tier);
  tier = tier || "budget";

  const activities = activityCost();
  const base = baseCost(tier);
  const total = base + activities;

  const outDays = plan.map((d) => {
    const dayActivities = d.activities.reduce((s, a) => s + (a.estimatedCost || 0) * travellers, 0);
    const title = d.isArrival ? `Arrival in ${d.area}` : d.isDeparture ? `${d.area} & departure` : d.activities.length ? `Explore ${d.area}` : `Leisure day in ${d.area}`;
    return {
      day: d.day,
      area: d.area,
      title,
      stay: d.isDeparture ? null : d.area, // where you sleep that night
      activities: d.activities.map(({ name, description, categories, durationHours, estimatedCost, timeOfDay }) => ({ name, description, categories, durationHours, estimatedCost, timeOfDay })),
      estimatedCost: Math.round(cpd[tier] * travellers + dayActivities),
    };
  });

  return {
    destination: { name: destination.name, bestTimeToVisit: destination.bestTimeToVisit },
    summary: {
      days,
      nights: Math.max(0, days - 1),
      travellers,
      pace,
      interests,
      tier,
      budget,
      estimatedTotal: Math.round(total),
      perPerson: Math.round(total / travellers),
      withinBudget,
      remaining: Math.round(budget - total),
      shortfall: withinBudget ? 0 : Math.round(total - budget),
    },
    breakdown: {
      stay: Math.round(base * 0.5),
      food: Math.round(base * 0.25),
      localTransport: Math.round(base * 0.25),
      activities: Math.round(activities),
    },
    route: outDays.map((d) => d.area),
    days: outDays,
    droppedForBudget: dropped,
    notes: withinBudget
      ? []
      : [`Your budget is about Rs. ${Math.round(total - budget).toLocaleString("en-IN")} short for ${days} days. Try fewer days, fewer travellers, or a larger budget.`],
  };
};

/* ---------------- DB-backed wrapper ---------------- */

const findDestination = async (query) => {
  if (mongoose.isValidObjectId(query)) {
    const byId = await Destination.findOne({ _id: query, isActive: true });
    if (byId) return byId;
  }
  const rx = safeRegex(query);
  return (
    (await Destination.findOne({ isActive: true, $or: [{ name: rx }, { city: rx }, { state: rx }], "attractions.0": { $exists: true } }).sort({ createdAt: 1 })) ||
    Destination.findOne({ isActive: true, $or: [{ name: rx }, { city: rx }, { state: rx }] })
  );
};

const suggestPackages = (destinationId, { days, budget, travellers }) =>
  Package.find({
    destination: destinationId,
    isActive: true,
    price: { $lte: Math.floor(budget / Math.max(1, travellers)) },
    "duration.days": { $gte: Math.max(1, days - 1), $lte: days + 1 },
  })
    .select("name slug price duration packageType rating gallery")
    .sort({ rating: -1, price: 1 })
    .limit(3)
    .lean();

const suggestHotels = async (destination, { days, stayBudget, travellers }) => {
  const nights = Math.max(1, days - 1);
  const roomsNeeded = Math.ceil(travellers / 2);
  const hotels = await Hotel.find({ isActive: true, $or: [{ destination: destination._id }, { "location.city": safeRegex(destination.city) }] })
    .select("name slug images rating hotelType location")
    .limit(30)
    .lean();
  if (!hotels.length) return [];

  const price = await cheapestRoomPrices(hotels.map((h) => h._id));

  const priced = hotels
    .filter((h) => price.has(String(h._id)))
    .map((h) => ({ ...h, fromPrice: price.get(String(h._id)), tripCost: price.get(String(h._id)) * nights * roomsNeeded }));

  const fitting = priced.filter((h) => h.tripCost <= stayBudget).sort((a, b) => b.rating - a.rating || a.tripCost - b.tripCost);
  if (fitting.length) return fitting.slice(0, 3);

  // Nothing fits the stay budget: show the two cheapest and say by how much they overshoot, rather than an empty list.
  return priced
    .sort((a, b) => a.tripCost - b.tripCost)
    .slice(0, 2)
    .map((h) => ({ ...h, overBudgetBy: Math.round(h.tripCost - stayBudget) }));
};

const generateItinerary = async (input) => {
  const destination = await findDestination(input.destination);
  if (!destination) throw httpError(404, `We couldn't find a destination matching "${input.destination}"`);

  const plan = buildItinerary({ destination, days: input.days, budget: input.budget, travellers: input.travellers, interests: input.interests, pace: input.pace });

  const [packages, hotels] = await Promise.all([
    suggestPackages(destination._id, { days: input.days, budget: input.budget, travellers: input.travellers }),
    suggestHotels(destination, { days: input.days, stayBudget: plan.breakdown.stay + Math.max(0, plan.summary.remaining), travellers: input.travellers }),
  ]);

  return { ...plan, destination: { _id: destination._id, ...plan.destination, name: destination.name, city: destination.city, state: destination.state }, suggestions: { packages, hotels } };
};

module.exports = { buildItinerary, generateItinerary, scoreAttraction, resolveAreas };
