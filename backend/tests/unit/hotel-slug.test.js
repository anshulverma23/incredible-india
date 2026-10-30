const mongoose = require("mongoose");
const request = require("supertest");
const app = require("../../app");
const Hotel = require("../../models/hotel.model");
const { idOrSlugFilter } = require("../../utils/slugify");
const { chain } = require("../api/helpers");

afterEach(() => jest.restoreAllMocks());

const base = (over = {}) => ({
  name: "Taj Lake Palace",
  description: "A palace on the lake.",
  location: { address: "Pichola", city: "Udaipur" },
  ...over,
});

// `slugsInUse` simulates slugs that already exist in the database.
const mockExists = (slugsInUse = []) =>
  jest.spyOn(Hotel, "exists").mockImplementation(async (filter) => (slugsInUse.includes(filter.slug) ? { _id: "x" } : null));

describe("idOrSlugFilter", () => {
  test("24-char id -> by _id, anything else -> by lowercase slug", () => {
    expect(idOrSlugFilter("6a868de767e1c090fa4a8275")).toEqual({ _id: "6a868de767e1c090fa4a8275" });
    expect(idOrSlugFilter("Taj-Lake-Palace")).toEqual({ slug: "taj-lake-palace" });
    expect(idOrSlugFilter("abcdefabcdef")).toEqual({ slug: "abcdefabcdef" }); // 12 chars is NOT an id
  });
});

describe("hotel slug on save", () => {
  test("create: slug is generated from the name", async () => {
    mockExists([]);
    const hotel = new Hotel(base());
    await hotel.validate();
    expect(hotel.slug).toBe("taj-lake-palace");
  });

  test("create: same name gets -2, -3 ...", async () => {
    mockExists(["taj-lake-palace", "taj-lake-palace-2"]);
    const hotel = new Hotel(base());
    await hotel.validate();
    expect(hotel.slug).toBe("taj-lake-palace-3");
  });

  test("create: admin can type a custom slug (it is cleaned up)", async () => {
    mockExists([]);
    const hotel = new Hotel(base({ slug: "Best Udaipur Hotel 2026" }));
    await hotel.validate();
    expect(hotel.slug).toBe("best-udaipur-hotel-2026");
  });

  test("create: non-latin name falls back to hotel-<id>", async () => {
    mockExists([]);
    const hotel = new Hotel(base({ name: "होटल उदयपुर" }));
    await hotel.validate();
    expect(hotel.slug).toBe(`hotel-${hotel._id.toString().slice(-6)}`);
  });

  test("rename: slug stays the same so old/Google links keep working", async () => {
    mockExists([]);
    const hotel = Hotel.hydrate({ _id: new mongoose.Types.ObjectId(), ...base(), slug: "taj-lake-palace" });
    hotel.name = "Taj Lake Palace Udaipur";
    await hotel.validate();
    expect(hotel.slug).toBe("taj-lake-palace");
  });

  test("edit: admin changes the slug explicitly", async () => {
    mockExists([]);
    const hotel = Hotel.hydrate({ _id: new mongoose.Types.ObjectId(), ...base(), slug: "taj-lake-palace" });
    hotel.slug = "Lake Palace Deal";
    await hotel.validate();
    expect(hotel.slug).toBe("lake-palace-deal");
  });

  test("old hotel without slug gets one on the next save", async () => {
    mockExists([]);
    const hotel = Hotel.hydrate({ _id: new mongoose.Types.ObjectId(), ...base() });
    expect(hotel.slug).toBeUndefined();
    await hotel.validate();
    expect(hotel.slug).toBe("taj-lake-palace");
  });
});

describe("GET /api/hotels/:idOrSlug", () => {
  const spyFindOne = () => {
    const c = chain({ _id: new mongoose.Types.ObjectId(), slug: "x" });
    return jest.spyOn(Hotel, "findOne").mockReturnValue(c);
  };
  // rooms query
  beforeEach(() => {
    const Room = require("../../models/room.model");
    jest.spyOn(Room, "find").mockReturnValue(chain([]));
  });

  test("slug in the URL -> looked up by slug", async () => {
    const spy = spyFindOne();
    const res = await request(app).get("/api/hotels/Taj-Lake-Palace");
    expect(res.status).toBe(200);
    expect(spy).toHaveBeenCalledWith({ slug: "taj-lake-palace" });
  });

  test("old MongoDB id in the URL still works", async () => {
    const spy = spyFindOne();
    const id = "6a868de767e1c090fa4a8275";
    const res = await request(app).get(`/api/hotels/${id}`);
    expect(res.status).toBe(200);
    expect(spy).toHaveBeenCalledWith({ _id: id });
  });

  test("unknown slug -> 404", async () => {
    jest.spyOn(Hotel, "findOne").mockReturnValue(chain(null));
    const res = await request(app).get("/api/hotels/does-not-exist");
    expect(res.status).toBe(404);
  });
});
