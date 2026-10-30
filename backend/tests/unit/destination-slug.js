const mongoose = require("mongoose");
const request = require("supertest");
const app = require("../../app");
const Destination = require("../../models/destination.model");
const Hotel = require("../../models/hotel.model");
const Package = require("../../models/package.model");
const { chain } = require("../api/helpers");

afterEach(() => jest.restoreAllMocks());

const base = (over = {}) => ({
  name: "Kashmir",
  country: "India",
  state: "Jammu & Kashmir",
  city: "Srinagar",
  description: "Paradise on earth.",
  ...over,
});

// `slugsInUse` simulates slugs that already exist in the database.
const mockExists = (slugsInUse = []) =>
  jest.spyOn(Destination, "exists").mockImplementation(async (filter) => (slugsInUse.includes(filter.slug) ? { _id: "x" } : null));

describe("destination slug on save", () => {
  test("create: slug is generated from the name", async () => {
    mockExists([]);
    const d = new Destination(base());
    await d.validate();
    expect(d.slug).toBe("kashmir");
  });

  test("create: same name gets -2, -3 ...", async () => {
    mockExists(["kashmir", "kashmir-2"]);
    const d = new Destination(base());
    await d.validate();
    expect(d.slug).toBe("kashmir-3");
  });

  test("create: admin can type a custom slug (it is cleaned up)", async () => {
    mockExists([]);
    const d = new Destination(base({ slug: "Best Kashmir Trip" }));
    await d.validate();
    expect(d.slug).toBe("best-kashmir-trip");
  });

  test("create: non-latin name falls back to destination-<id>", async () => {
    mockExists([]);
    const d = new Destination(base({ name: "कश्मीर" }));
    await d.validate();
    expect(d.slug).toBe(`destination-${d._id.toString().slice(-6)}`);
  });

  test("rename: slug stays the same so old/Google links keep working", async () => {
    mockExists([]);
    const d = Destination.hydrate({ _id: new mongoose.Types.ObjectId(), ...base(), slug: "kashmir" });
    d.name = "Kashmir Valley";
    await d.validate();
    expect(d.slug).toBe("kashmir");
  });

  test("edit: admin changes the slug explicitly", async () => {
    mockExists([]);
    const d = Destination.hydrate({ _id: new mongoose.Types.ObjectId(), ...base(), slug: "kashmir" });
    d.slug = "Kashmir Valley Guide";
    await d.validate();
    expect(d.slug).toBe("kashmir-valley-guide");
  });

  test("old destination without slug gets one on the next save", async () => {
    mockExists([]);
    const d = Destination.hydrate({ _id: new mongoose.Types.ObjectId(), ...base() });
    expect(d.slug).toBeUndefined();
    await d.validate();
    expect(d.slug).toBe("kashmir");
  });
});

describe("GET /api/destinations/:idOrSlug", () => {
  const dest = () => ({ _id: new mongoose.Types.ObjectId(), slug: "kashmir", name: "Kashmir" });
  beforeEach(() => {
    jest.spyOn(Hotel, "find").mockReturnValue(chain([]));
    jest.spyOn(Package, "find").mockReturnValue(chain([]));
  });

  test("slug in the URL -> looked up by slug", async () => {
    const spy = jest.spyOn(Destination, "findOne").mockResolvedValue(dest());
    const res = await request(app).get("/api/destinations/Kashmir");
    expect(res.status).toBe(200);
    expect(spy).toHaveBeenCalledWith({ slug: "kashmir" });
  });

  test("old MongoDB id in the URL still works", async () => {
    const spy = jest.spyOn(Destination, "findOne").mockResolvedValue(dest());
    const id = "6a868de767e1c090fa4a8275";
    const res = await request(app).get(`/api/destinations/${id}`);
    expect(res.status).toBe(200);
    expect(spy).toHaveBeenCalledWith({ _id: id });
  });

  test("unknown slug -> 404", async () => {
    jest.spyOn(Destination, "findOne").mockResolvedValue(null);
    const res = await request(app).get("/api/destinations/does-not-exist");
    expect(res.status).toBe(404);
  });
});
