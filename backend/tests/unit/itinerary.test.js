const { buildItinerary } = require("../../services/itinerary.service");

const A = (name, area, categories, estimatedCost = 0, timeOfDay = "any", durationHours = 3) => ({ name, area, categories, estimatedCost, timeOfDay, durationHours });
const kashmir = {
  name: "Kashmir Valley",
  city: "Srinagar",
  areas: ["Srinagar", "Gulmarg", "Pahalgam", "Sonamarg"],
  costPerDay: { budget: 2200, standard: 4200, luxury: 8500 },
  attractions: [
    A("Dal Lake Shikara", "Srinagar", ["Nature", "Relaxation"], 800, "evening", 2), A("Mughal Gardens", "Srinagar", ["Culture", "Nature"], 50), A("Shankaracharya", "Srinagar", ["Spiritual"], 0, "morning"),
    A("Gondola", "Gulmarg", ["Adventure", "Nature"], 1800, "morning"), A("Apharwat Trek", "Gulmarg", ["Adventure"], 0, "any", 5), A("Alpather", "Gulmarg", ["Nature"]),
    A("Betaab", "Pahalgam", ["Nature"], 300), A("Rafting", "Pahalgam", ["Adventure"], 1500), A("Aru Valley", "Pahalgam", ["Nature", "Adventure"], 600),
    A("Thajiwas", "Sonamarg", ["Nature", "Adventure"], 1200, "morning"), A("Zojila drive", "Sonamarg", ["Adventure", "Nature"]), A("Baltal", "Sonamarg", ["Nature"]),
  ],
};

describe("itinerary engine", () => {
  test("roadmap example: 5 days Kashmir, Rs.40,000, Adventure + Nature", () => {
    const r = buildItinerary({ destination: kashmir, days: 5, budget: 40000, travellers: 2, interests: ["Adventure", "Nature"] });
    expect(r.route).toEqual(["Srinagar", "Gulmarg", "Pahalgam", "Sonamarg", "Srinagar"]);
    expect(r.summary.withinBudget).toBe(true);
    expect(r.summary.estimatedTotal).toBeLessThanOrEqual(40000);
    expect(r.days).toHaveLength(5);
    r.days.forEach((day) => expect(day.activities.length).toBeGreaterThan(0));
  });
  test("never repeats an attraction", () => {
    const r = buildItinerary({ destination: kashmir, days: 7, budget: 150000, travellers: 2, interests: ["Nature"] });
    const names = r.days.flatMap((d) => d.activities.map((a) => a.name));
    expect(new Set(names).size).toBe(names.length);
  });
  test("interests steer the choices", () => {
    const r = buildItinerary({ destination: kashmir, days: 3, budget: 60000, travellers: 1, interests: ["Adventure"], pace: "relaxed" });
    const gulmarg = r.days.find((d) => d.area === "Gulmarg") || r.days[1];
    expect(gulmarg.activities[0].categories).toContain("Adventure");
  });
  test("richer budgets buy a better tier", () => {
    const poor = buildItinerary({ destination: kashmir, days: 4, budget: 20000, travellers: 2 });
    const rich = buildItinerary({ destination: kashmir, days: 4, budget: 120000, travellers: 2 });
    expect(poor.summary.tier).toBe("budget");
    expect(rich.summary.tier).toBe("luxury");
  });
  test("an impossible budget is reported honestly with the shortfall", () => {
    const r = buildItinerary({ destination: kashmir, days: 5, budget: 10000, travellers: 2 });
    expect(r.summary.withinBudget).toBe(false);
    expect(r.summary.shortfall).toBeGreaterThan(0);
    expect(r.notes[0]).toMatch(/short/);
  });
  test("works for a single-city destination and a 1-day trip", () => {
    const jaipur = { name: "Jaipur", city: "Jaipur", areas: ["Jaipur"], attractions: [A("Amber", "Jaipur", ["Heritage"], 500), A("City Palace", "Jaipur", ["Heritage"], 700)] };
    const r = buildItinerary({ destination: jaipur, days: 1, budget: 9000, travellers: 1, interests: ["Heritage"] });
    expect(r.days).toHaveLength(1);
    expect(r.days[0].area).toBe("Jaipur");
  });
});
