const PDFDocument = require("pdfkit");

// Built-in PDF fonts (Helvetica) have no rupee glyph, so amounts are printed as "Rs.".
const inr = (n) => `Rs. ${Number(n || 0).toLocaleString("en-IN")}`;
const date = (d) => (d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "-");

const BRAND = "#1a5f4a";

/**
 * Renders the invoice into any writable stream (an HTTP response) or collects it into a Buffer (email attachment).
 * `booking` must have user, hotel/package and payment populated where available.
 */
const buildInvoice = (booking, payment, target) => {
  const doc = new PDFDocument({ margin: 50, size: "A4", info: { Title: `Invoice ${booking.invoiceNumber}` } });
  if (target) doc.pipe(target);

  const isPaid = booking.paymentStatus === "paid" || booking.paymentStatus === "partially_refunded" || booking.paymentStatus === "refunded";
  const left = 50;
  const right = doc.page.width - 50;

  // ---- Header ----
  doc.rect(0, 0, doc.page.width, 90).fill(BRAND);
  doc.fillColor("#fff").fontSize(24).font("Helvetica-Bold").text("India Travel", left, 30);
  doc.fontSize(11).font("Helvetica").text("Tax Invoice", left, 58);
  doc.fontSize(10).text(`Invoice: ${booking.invoiceNumber}`, 0, 32, { align: "right", width: right });
  doc.text(`Date: ${date(booking.confirmedAt || booking.createdAt)}`, 0, 48, { align: "right", width: right });

  // ---- Customer + booking meta ----
  doc.fillColor("#000").font("Helvetica-Bold").fontSize(11).text("Billed to", left, 115);
  doc.font("Helvetica").fontSize(10).fillColor("#333");
  doc.text(booking.user?.name || "-", left, 132);
  doc.text(booking.user?.email || "-");
  if (booking.user?.phone) doc.text(booking.user.phone);

  doc.font("Helvetica-Bold").fontSize(11).fillColor("#000").text("Booking details", 330, 115);
  doc.font("Helvetica").fontSize(10).fillColor("#333");
  doc.text(`Booking ID: ${booking.bookingReference}`, 330, 132);
  doc.text(`Booking status: ${String(booking.bookingStatus).toUpperCase()}`);
  if (payment?.razorpayPaymentId) doc.text(`Payment ID: ${payment.razorpayPaymentId}`);

  // ---- Item table ----
  let y = 215;
  doc.rect(left, y, right - left, 22).fill("#f0f4f2");
  doc.fillColor("#000").font("Helvetica-Bold").fontSize(10).text("Description", left + 8, y + 6).text("Details", 300, y + 6);
  y += 32;

  const lines = [];
  if (booking.bookingType === "hotel") {
    lines.push(["Hotel", booking.hotel?.name || "N/A"]);
    if (booking.hotel?.location?.city) lines.push(["City", booking.hotel.location.city]);
    lines.push(["Check-in", date(booking.checkIn)], ["Check-out", date(booking.checkOut)], ["Rooms", String(booking.numberOfRooms || 1)]);
  } else {
    lines.push(["Package", booking.package?.name || "N/A"], ["Travel date", date(booking.travelDate)]);
  }
  lines.push(["Guests", `${booking.guests?.adults || 1} adult(s), ${booking.guests?.children || 0} child(ren)`]);
  if (booking.couponCode) lines.push(["Coupon applied", booking.couponCode]);

  doc.font("Helvetica").fontSize(10).fillColor("#333");
  for (const [k, v] of lines) {
    doc.text(k, left + 8, y).text(v, 300, y, { width: right - 300 });
    y += 20;
  }

  // ---- Totals ----
  y += 15;
  doc.moveTo(300, y).lineTo(right, y).strokeColor("#ddd").stroke();
  y += 10;
  const totals = [
    ["Subtotal", inr(booking.pricing.basePrice)],
    ["Discount", `- ${inr(booking.pricing.discount)}`],
    ["Tax (GST)", inr(booking.pricing.tax)],
  ];
  for (const [k, v] of totals) {
    doc.font("Helvetica").fontSize(10).fillColor("#333").text(k, 300, y).text(v, 300, y, { width: right - 300, align: "right" });
    y += 18;
  }
  doc.moveTo(300, y).lineTo(right, y).strokeColor("#999").stroke();
  y += 8;
  doc.font("Helvetica-Bold").fontSize(13).fillColor("#000").text("Total", 300, y).text(inr(booking.pricing.totalAmount), 300, y, { width: right - 300, align: "right" });
  y += 40;

  // ---- Payment status stamp ----
  const color = isPaid ? "#1a7f37" : "#b45309";
  doc.save().roundedRect(left, y, 150, 36, 6).lineWidth(2).strokeColor(color).stroke();
  doc.fillColor(color).font("Helvetica-Bold").fontSize(16).text(isPaid ? "PAID" : String(booking.paymentStatus).toUpperCase(), left, y + 10, { width: 150, align: "center" });
  doc.restore();

  doc.fillColor("#888").font("Helvetica").fontSize(8).text("This is a computer-generated invoice and does not require a signature.", left, 770, { align: "center", width: right - left });

  doc.end();
  return doc;
};

/** Resolves with the finished PDF as a Buffer (for email attachments). */
const invoiceToBuffer = (booking, payment) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    const { PassThrough } = require("stream");
    const sink = new PassThrough();
    sink.on("data", (c) => chunks.push(c));
    sink.on("end", () => resolve(Buffer.concat(chunks)));
    sink.on("error", reject);
    buildInvoice(booking, payment, sink);
  });

module.exports = { buildInvoice, invoiceToBuffer };
