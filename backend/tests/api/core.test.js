const request = require("supertest");
const app = require("../../app");
const User = require("../../models/user.model");
const { mockAuth, auth, chain, ids } = require("./helpers");

afterEach(() => jest.restoreAllMocks());

describe("platform basics", () => {
  test("health check", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("uptime");
  });
  test("security headers are set (helmet) and x-powered-by is hidden", async () => {
    const res = await request(app).get("/api/health");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-powered-by"]).toBeUndefined();
  });
  test("unknown routes return a JSON 404", async () => {
    const res = await request(app).get("/api/nope");
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
  test("malformed JSON is a 400, not a 500", async () => {
    const res = await request(app).post("/api/auth/login").set("Content-Type", "application/json").send("{bad json");
    expect(res.status).toBe(400);
  });
  test("CORS: a foreign origin is rejected", async () => {
    const res = await request(app).get("/api/health").set("Origin", "https://evil.example");
    expect(res.status).toBe(403);
  });
  test("CORS: the configured frontend origin is allowed with credentials", async () => {
    const res = await request(app).get("/api/health").set("Origin", "http://localhost:5173");
    expect(res.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
    expect(res.headers["access-control-allow-credentials"]).toBe("true");
  });
  test("swagger docs are served", async () => {
    const res = await request(app).get("/api/docs/");
    expect(res.status).toBe(200);
  });
});

describe("authentication", () => {
  test("login validates input", async () => {
    const res = await request(app).post("/api/auth/login").send({ email: "not-an-email", password: "x" });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/email/i);
  });
  test("NoSQL operator injection in login is rejected", async () => {
    const find = jest.spyOn(User, "findOne");
    const res = await request(app).post("/api/auth/login").send({ email: { $gt: "" }, password: { $gt: "" } });
    expect(res.status).toBe(400);
    expect(find).not.toHaveBeenCalled();
  });
  test("wrong credentials -> 401 with a generic message", async () => {
    jest.spyOn(User, "findOne").mockReturnValue({ select: () => Promise.resolve(null) });
    const res = await request(app).post("/api/auth/login").send({ email: "a@b.co", password: "Password1" });
    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Invalid email or password");
  });
  test("weak passwords are refused at registration", async () => {
    const res = await request(app).post("/api/auth/register").send({ name: "Asha", email: "asha@test.dev", password: "abcdefgh" });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/number/);
  });
  test("registration ignores a client-supplied role and sets an httpOnly refresh cookie", async () => {
    jest.spyOn(User, "exists").mockResolvedValue(null);
    const created = { _id: ids.user, name: "Asha", email: "asha@test.dev", role: "user", tokenVersion: 0, createVerificationToken: () => "raw", save: async () => {} };
    const create = jest.spyOn(User, "create").mockResolvedValue(created);
    jest.spyOn(User, "findById").mockReturnValue({ select: async () => ({ refreshTokens: [], save: async () => {} }) });

    const res = await request(app).post("/api/auth/register").send({ name: "Asha", email: "asha@test.dev", password: "Passw0rdOK", role: "admin" });
    expect(res.status).toBe(201);
    expect(create.mock.calls[0][0]).not.toHaveProperty("role");
    expect(res.body.token).toBeTruthy();
    expect(res.headers["set-cookie"].join(";")).toMatch(/refreshToken=.*HttpOnly/i);
    expect(res.body.user).not.toHaveProperty("password");
  });
  test("protected route without a token -> 401", async () => {
    const res = await request(app).get("/api/bookings/my");
    expect(res.status).toBe(401);
  });
  test("tampered token -> 401", async () => {
    const res = await request(app).get("/api/bookings/my").set("Authorization", "Bearer abc.def.ghi");
    expect(res.status).toBe(401);
  });
  test("a token whose tokenVersion was bumped (password change / logout-all) stops working", async () => {
    mockAuth();
    User.findById.mockResolvedValue({ _id: ids.user, role: "user", isActive: true, tokenVersion: 5 });
    const res = await request(app).get("/api/auth/me").set(auth.user());
    expect(res.status).toBe(401);
  });
  test("deactivated accounts are blocked", async () => {
    mockAuth();
    User.findById.mockResolvedValue({ _id: ids.user, role: "user", isActive: false, tokenVersion: 0 });
    const res = await request(app).get("/api/auth/me").set(auth.user());
    expect(res.status).toBe(401);
  });
});

describe("authorization (RBAC)", () => {
  beforeEach(() => mockAuth());

  test("public catalogue needs no login", async () => {
    const Package = require("../../models/package.model");
    const Destination = require("../../models/destination.model");
    jest.spyOn(Destination, "find").mockReturnValue(chain([]));
    jest.spyOn(Package, "find").mockReturnValue(chain([]));
    jest.spyOn(Package, "countDocuments").mockResolvedValue(0);
    const res = await request(app).get("/api/packages?destination=Kashmir&minPrice=20000&maxPrice=50000&minDuration=5&maxDuration=7&category=Adventure&minRating=4");
    expect(res.status).toBe(200);
    expect(res.body.packages).toEqual([]);
  });
  test("POST /packages -> 401 anonymous, 403 user", async () => {
    expect((await request(app).post("/api/packages").send({})).status).toBe(401);
    expect((await request(app).post("/api/packages").set(auth.user()).send({})).status).toBe(403);
  });
  test("DELETE /packages/:id -> 403 for a normal user", async () => {
    const res = await request(app).delete(`/api/packages/${ids.user}`).set(auth.user());
    expect(res.status).toBe(403);
  });
  test("FAQ writes are admin only (was open to every logged-in user)", async () => {
    const res = await request(app).post("/api/faqs").set(auth.user()).send({ question: "Q?", answer: "A" });
    expect(res.status).toBe(403);
  });
  test("a normal user cannot create destinations or manage users", async () => {
    expect((await request(app).post("/api/destinations").set(auth.user()).send({})).status).toBe(403);
    expect((await request(app).get("/api/users").set(auth.user())).status).toBe(403);
  });
  test("an old hotel_manager / agent / super_admin role no longer exists and is denied everywhere", async () => {
    expect((await request(app).get("/api/users").set(auth.legacy())).status).toBe(403);
    expect((await request(app).get("/api/admin/dashboard").set(auth.legacy())).status).toBe(403);
    expect((await request(app).get("/api/bookings").set(auth.legacy())).status).toBe(403);
  });
  test("admin can reach admin payment list", async () => {
    const Payment = require("../../models/payment.model");
    jest.spyOn(Payment, "find").mockReturnValue(chain([]));
    jest.spyOn(Payment, "countDocuments").mockResolvedValue(0);
    const res = await request(app).get("/api/payment/admin").set(auth.admin());
    expect(res.status).toBe(200);
    expect(res.body.pagination).toMatchObject({ page: 1, total: 0 });
  });
  test("normal user cannot reach admin payment list or dashboard", async () => {
    expect((await request(app).get("/api/payment/admin").set(auth.user())).status).toBe(403);
    expect((await request(app).get("/api/admin/dashboard").set(auth.user())).status).toBe(403);
  });
  test("role can only be user or admin (super_admin / hotel_manager / agent are rejected)", async () => {
    const target = { _id: "665f1c2e8f1b2c0012345099", role: "user", tokenVersion: 0, save: jest.fn() };
    User.findById.mockImplementation(async (id) => (String(id) === target._id ? target : { _id: ids.admin, role: "admin", isActive: true, tokenVersion: 0 }));
    for (const role of ["super_admin", "hotel_manager", "agent"]) {
      const res = await request(app).put(`/api/users/${target._id}`).set(auth.admin()).send({ role });
      expect(res.status).toBe(400);
    }
    expect(target.save).not.toHaveBeenCalled();
  });
  test("a normal user cannot promote anyone to admin", async () => {
    const res = await request(app).put(`/api/users/665f1c2e8f1b2c0012345099`).set(auth.user()).send({ role: "admin" });
    expect(res.status).toBe(403);
  });
  test("admin can promote a user to admin", async () => {
    const target = { _id: "665f1c2e8f1b2c0012345099", role: "user", tokenVersion: 0, save: jest.fn() };
    User.findById.mockImplementation(async (id) => (String(id) === target._id ? target : { _id: ids.admin, role: "admin", isActive: true, tokenVersion: 0 }));
    const res = await request(app).put(`/api/users/${target._id}`).set(auth.admin()).send({ role: "admin" });
    expect(res.status).toBe(200);
    expect(target.role).toBe("admin");
    expect(target.tokenVersion).toBe(1);
  });
  test("admin cannot change their own role", async () => {
    User.findById.mockImplementation(async () => ({ _id: ids.admin, role: "admin", isActive: true, tokenVersion: 0, save: jest.fn() }));
    const res = await request(app).put(`/api/users/${ids.admin}`).set(auth.admin()).send({ role: "user" });
    expect(res.status).toBe(400);
  });
});

describe("validation", () => {
  beforeEach(() => mockAuth());
  test("package booking requires a travel date and valid ids", async () => {
    const res = await request(app).post("/api/bookings").set(auth.user()).send({ bookingType: "package", packageId: "nope" });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/packageId|travelDate/);
  });
  test("client cannot send a price - extra fields are ignored", async () => {
    const { createBooking } = require("../../validators/booking.validator");
    const parsed = createBooking.parse({ bookingType: "package", packageId: ids.user, travelDate: "2030-01-01", totalAmount: 1, pricing: { totalAmount: 1 } });
    expect(parsed).not.toHaveProperty("totalAmount");
    expect(parsed).not.toHaveProperty("pricing");
  });
  test("itinerary input is validated", async () => {
    const res = await request(app).post("/api/itinerary/generate").send({ destination: "Kashmir", days: 99, budget: 10 });
    expect(res.status).toBe(400);
  });
});
