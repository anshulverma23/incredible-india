const crypto = require("crypto");
const request = require("supertest");
const app = require("../../app");
const Payment = require("../../models/payment.model");
const WebhookEvent = require("../../models/webhookEvent.model");
const Destination = require("../../models/destination.model");
const Package = require("../../models/package.model");
const Hotel = require("../../models/hotel.model");
const Room = require("../../models/room.model");
const { mockAuth, auth, chain, ids } = require("./helpers");

afterEach(() => jest.restoreAllMocks());

const sign = (body, secret) => crypto.createHmac("sha256", secret).update(body).digest("hex");

describe("POST /payment/verify (never trust the browser)", () => {
  beforeEach(() => mockAuth());

  test("bad signature -> 400 and the DB is never consulted", async () => {
    const find = jest.spyOn(Payment, "findOne");
    const res = await request(app).post("/api/payment/verify").set(auth.user()).send({ razorpay_order_id: "order_123456", razorpay_payment_id: "pay_123456", razorpay_signature: "f".repeat(64) });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/signature/i);
    expect(find).not.toHaveBeenCalled();
  });
  test("a valid signature for SOMEONE ELSE'S payment is refused (403)", async () => {
    const orderId = "order_123456";
    const paymentId = "pay_123456";
    const signature = sign(`${orderId}|${paymentId}`, process.env.RAZORPAY_KEY_SECRET);
    jest.spyOn(Payment, "findOne").mockResolvedValue({ razorpayOrderId: orderId, user: "665f1c2e8f1b2c0012349999", amount: 100 });
    const res = await request(app).post("/api/payment/verify").set(auth.user()).send({ razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature });
    expect(res.status).toBe(403);
  });
  test("requires login", async () => {
    expect((await request(app).post("/api/payment/verify").send({})).status).toBe(401);
  });
});

describe("POST /payment/webhook", () => {
  const post = (payload, { secret = process.env.RAZORPAY_WEBHOOK_SECRET, id = "evt_1" } = {}) => {
    const raw = JSON.stringify(payload);
    return request(app).post("/api/payment/webhook").set("Content-Type", "application/json").set("x-razorpay-signature", sign(raw, secret)).set("x-razorpay-event-id", id).send(raw);
  };

  test("invalid signature -> 400, nothing processed", async () => {
    const exists = jest.spyOn(WebhookEvent, "exists");
    const res = await post({ event: "payment.captured" }, { secret: "wrong" });
    expect(res.status).toBe(400);
    expect(exists).not.toHaveBeenCalled();
  });
  test("missing signature header -> 400", async () => {
    const res = await request(app).post("/api/payment/webhook").set("Content-Type", "application/json").send(JSON.stringify({ event: "x" }));
    expect(res.status).toBe(400);
  });
  test("duplicate delivery (same event id) is acknowledged and skipped - idempotency", async () => {
    jest.spyOn(WebhookEvent, "exists").mockResolvedValue({ _id: "x" });
    const find = jest.spyOn(Payment, "findOneAndUpdate");
    const res = await post({ event: "payment.captured", payload: { payment: { entity: { id: "pay_1", order_id: "order_1" } } } });
    expect(res.status).toBe(200);
    expect(res.body.duplicate).toBe(true);
    expect(find).not.toHaveBeenCalled();
  });
  test("payment.failed marks the payment failed and records the event", async () => {
    jest.spyOn(WebhookEvent, "exists").mockResolvedValue(null);
    const create = jest.spyOn(WebhookEvent, "create").mockResolvedValue({});
    jest.spyOn(Payment, "findOne").mockReturnValue({ select: () => Promise.resolve({ _id: "665f1c2e8f1b2c00123450aa" }) });
    const update = jest.spyOn(Payment, "findOneAndUpdate").mockResolvedValue(null); // nothing to downgrade (e.g. already paid)
    const res = await post({ event: "payment.failed", payload: { payment: { entity: { id: "pay_1", order_id: "order_1", error_description: "Card declined" } } } }, { id: "evt_fail" });
    expect(res.status).toBe(200);
    expect(update).toHaveBeenCalledWith({ _id: "665f1c2e8f1b2c00123450aa", status: "created" }, expect.objectContaining({ $set: expect.objectContaining({ status: "failed", failureReason: "Card declined" }) }), { new: true });
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ eventId: "evt_fail" }));
  });
  test("unknown events are acknowledged (so Razorpay stops retrying)", async () => {
    jest.spyOn(WebhookEvent, "exists").mockResolvedValue(null);
    jest.spyOn(WebhookEvent, "create").mockResolvedValue({});
    expect((await post({ event: "settlement.processed" }, { id: "evt_x" })).status).toBe(200);
  });
});

describe("itinerary engine over HTTP", () => {
  test("Kashmir 5 days, Rs.40,000, Adventure + Nature", async () => {
    const A = (name, area, categories, estimatedCost = 0) => ({ name, area, categories, estimatedCost, durationHours: 3, timeOfDay: "any" });
    const kashmir = {
      _id: ids.user, name: "Kashmir Valley", city: "Srinagar", state: "J&K", areas: ["Srinagar", "Gulmarg", "Pahalgam", "Sonamarg"], costPerDay: { budget: 2200, standard: 4200, luxury: 8500 },
      attractions: [A("Dal Lake", "Srinagar", ["Nature"], 800), A("Gondola", "Gulmarg", ["Adventure"], 1800), A("Betaab", "Pahalgam", ["Nature"], 300), A("Thajiwas", "Sonamarg", ["Adventure", "Nature"], 1200), A("Mughal Gardens", "Srinagar", ["Nature"], 50), A("Apharwat", "Gulmarg", ["Adventure"]), A("Aru", "Pahalgam", ["Adventure"], 600), A("Zojila", "Sonamarg", ["Adventure"])],
    };
    jest.spyOn(Destination, "findOne").mockReturnValue({ sort: () => Promise.resolve(kashmir) });
    jest.spyOn(Package, "find").mockReturnValue(chain([{ name: "Kashmir Paradise Tour", price: 24500 }]));
    jest.spyOn(Hotel, "find").mockReturnValue(chain([]));
    jest.spyOn(Room, "aggregate").mockResolvedValue([]);

    const res = await request(app).post("/api/itinerary/generate").send({ destination: "Kashmir", days: 5, budget: 40000, travellers: 2, interests: ["Adventure", "Nature"] });
    expect(res.status).toBe(200);
    expect(res.body.itinerary.route).toEqual(["Srinagar", "Gulmarg", "Pahalgam", "Sonamarg", "Srinagar"]);
    expect(res.body.itinerary.summary.withinBudget).toBe(true);
    expect(res.body.itinerary.suggestions.packages[0].name).toBe("Kashmir Paradise Tour");
  });
  test("unknown destination -> 404 with a helpful message", async () => {
    jest.spyOn(Destination, "findOne").mockReturnValue({ sort: () => Promise.resolve(null) });
    Destination.findOne.mockReturnValueOnce({ sort: () => Promise.resolve(null) }).mockResolvedValueOnce(null);
    const res = await request(app).post("/api/itinerary/generate").send({ destination: "Atlantis", days: 3, budget: 20000 });
    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/Atlantis/);
  });
});
