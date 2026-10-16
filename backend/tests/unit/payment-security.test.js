const crypto = require("crypto");
const { verifyPaymentSignature, verifyWebhookSignature } = require("../../utils/razorpay");

const sign = (data, secret) => crypto.createHmac("sha256", secret).update(data).digest("hex");

describe("Razorpay checkout signature", () => {
  const secret = "s3cret";
  const good = sign("order_1|pay_1", secret);

  test("accepts a valid signature", () => expect(verifyPaymentSignature({ orderId: "order_1", paymentId: "pay_1", signature: good, secret })).toBe(true));
  test("rejects a tampered payment id", () => expect(verifyPaymentSignature({ orderId: "order_1", paymentId: "pay_2", signature: good, secret })).toBe(false));
  test("rejects a signature made with another secret", () => expect(verifyPaymentSignature({ orderId: "order_1", paymentId: "pay_1", signature: sign("order_1|pay_1", "other"), secret })).toBe(false));
  test("rejects empty / wrong-length signatures without throwing", () => {
    expect(verifyPaymentSignature({ orderId: "order_1", paymentId: "pay_1", signature: "", secret })).toBe(false);
    expect(verifyPaymentSignature({ orderId: "order_1", paymentId: "pay_1", signature: "abc", secret })).toBe(false);
  });
});

describe("Razorpay webhook signature", () => {
  const secret = "whsec";
  const body = Buffer.from(JSON.stringify({ event: "payment.captured" }));
  test("valid", () => expect(verifyWebhookSignature({ rawBody: body, signature: sign(body, secret), secret })).toBe(true));
  test("body modified after signing", () => expect(verifyWebhookSignature({ rawBody: Buffer.from("{}"), signature: sign(body, secret), secret })).toBe(false));
  test("missing secret -> reject (never accept unsigned webhooks)", () => expect(verifyWebhookSignature({ rawBody: body, signature: sign(body, secret), secret: "" })).toBe(false));
});
