const mongoose = require("mongoose");
const request = require("supertest");
const app = require("../../app");
const Package = require("../../models/package.model");
const { slugify, isObjectIdString } = require("../../utils/slugify");
const { chain } = require("../api/helpers");

afterEach(() => jest.restoreAllMocks());

const base = (over = {}) => ({
  name: "Kashmir Paradise Tour",
  description: "Six unforgettable days.",
  destination: new mongoose.Types.ObjectId(),
  duration: { days: 6, nights: 5 },
  price: 24500,
  ...over,
});

// `slugsInUse` simulates slugs that already exist in the database.
const mockExists = (slugsInUse = []) =>
  jest.spyOn(Package, "exists").mockImplementation(async (filter) => (slugsInUse.includes(filter.slug) ? { _id: "x" } : null));

describe("slugify", () => {
  test("lowercase, accent-free, hyphen separated", () => {
    expect(slugify("Kashmir Paradise Tour")).toBe("kashmir-paradise-tour");
    expect(slugify("  Café  Déjà-vu  ")).toBe("cafe-deja-vu");
    expect(slugify("Goa & Beaches — 5D/4N!")).toBe("goa-and-beaches-5d-4n");
  });
  test("returns empty string when nothing usable is left", () => {
    expect(slugify("केरल यात्रा")).toBe("");
  });
  test("is capped in length without a trailing hyphen", () => {
    const s = slugify(`${"a".repeat(79)} bbb`);
    expect(s.length).toBeLessThanOrEqual(80);
    expect(s.endsWith("-")).toBe(false);
  });
  test("isObjectIdString is strict (a 12-char slug is NOT an id)", () => {
    expect(isObjectIdString("665f1c2e8f1b2c0012345001")).toBe(true);
    expect(isObjectIdString("ladakh-tour1")).toBe(false);
    expect(isObjectIdString("abcdefabcdef")).toBe(false);
  });
});

describe("package slug on save", () => {
  test("create: slug is generated from the name", async () => {
    mockExists([]);
    const pkg = new Package(base());
    await pkg.validate();
    expect(pkg.slug).toBe("kashmir-paradise-tour");
  });

  test("create: same name gets -2, -3 ...", async () => {
    mockExists(["kashmir-paradise-tour", "kashmir-paradise-tour-2"]);
    const pkg = new Package(base());
    await pkg.validate();
    expect(pkg.slug).toBe("kashmir-paradise-tour-3");
  });

  test("create: admin can type a custom slug (it is cleaned up)", async () => {
    mockExists([]);
    const pkg = new Package(base({ slug: "Best Kashmir Trip 2026" }));
    await pkg.validate();
    expect(pkg.slug).toBe("best-kashmir-trip-2026");
  });

  test("create: non-latin name falls back to package-<id>", async () => {
    mockExists([]);
    const pkg = new Package(base({ name: "केरल यात्रा" }));
    await pkg.validate();
    expect(pkg.slug).toBe(`package-${pkg._id.toString().slice(-6)}`);
  });

  test("rename: slug stays the same so old/Google links keep working", async () => {
    mockExists([]);
    const pkg = Package.hydrate({ _id: new mongoose.Types.ObjectId(), ...base(), slug: "kashmir-paradise-tour" });
    pkg.name = "Kashmir Paradise Tour 2026";
    await pkg.validate();
    expect(pkg.slug).toBe("kashmir-paradise-tour");
  });

  test("edit: admin changes the slug explicitly", async () => {
    mockExists([]);
    const pkg = Package.hydrate({ _id: new mongoose.Types.ObjectId(), ...base(), slug: "kashmir-paradise-tour" });
    pkg.slug = "Kashmir Honeymoon Deal";
    await pkg.validate();
    expect(pkg.slug).toBe("kashmir-honeymoon-deal");
  });

  test("old package without slug gets one on the next save", async () => {
    mockExists([]);
    const pkg = Package.hydrate({ _id: new mongoose.Types.ObjectId(), ...base() });
    expect(pkg.slug).toBeUndefined();
    await pkg.validate();
    expect(pkg.slug).toBe("kashmir-paradise-tour");
  });
});

describe("GET /api/packages/:idOrSlug", () => {
  const spyFindOne = () => {
    const c = chain({
      _id: new mongoose.Types.ObjectId(),
      slug: "x",
      maxGroupSize: 10,
      startDates: [],
    });
    return jest.spyOn(Package, "findOne").mockReturnValue(c);
  };

  test("slug in the URL -> looked up by slug", async () => {
    const spy = spyFindOne();
    const res = await request(app).get("/api/packages/Kashmir-Paradise-Tour");
    expect(res.status).toBe(200);
    expect(spy).toHaveBeenCalledWith({ slug: "kashmir-paradise-tour" });
  });

  test("old MongoDB id in the URL still works", async () => {
    const spy = spyFindOne();
    const id = "665f1c2e8f1b2c0012345001";
    const res = await request(app).get(`/api/packages/${id}`);
    expect(res.status).toBe(200);
    expect(spy).toHaveBeenCalledWith({ _id: id });
  });

  test("a 12-character slug is not mistaken for an ObjectId", async () => {
    const spy = spyFindOne();
    await request(app).get("/api/packages/ladakh-tour1");
    expect(spy).toHaveBeenCalledWith({ slug: "ladakh-tour1" });
  });

  test("unknown slug -> 404", async () => {
    jest.spyOn(Package, "findOne").mockReturnValue(chain(null));
    const res = await request(app).get("/api/packages/does-not-exist");
    expect(res.status).toBe(404);
  });
});
