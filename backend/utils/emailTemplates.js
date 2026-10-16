// Responsive HTML email templates. Every dynamic value goes through esc() so user-supplied text
// (names, special requests...) can never inject markup into an email.
const { env } = require("../config/env");

const esc = (v = "") =>
  String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");

const inr = (n) => `Rs. ${Number(n || 0).toLocaleString("en-IN")}`;
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "-");

const BRAND = "#1a5f4a";

const layout = (title, bodyHtml, preheader = "") => `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title></head>
<body style="margin:0;padding:0;background:#f4f6f5;font-family:Arial,Helvetica,sans-serif;color:#222;">
<span style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f5;padding:24px 12px;">
  <tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:10px;overflow:hidden;">
      <tr><td style="background:${BRAND};padding:20px 28px;color:#fff;font-size:20px;font-weight:bold;">India Travel</td></tr>
      <tr><td style="padding:28px;line-height:1.6;font-size:15px;">${bodyHtml}</td></tr>
      <tr><td style="padding:16px 28px;background:#fafafa;color:#777;font-size:12px;text-align:center;">
        You are receiving this email because of activity on your India Travel account.<br/>&copy; ${new Date().getFullYear()} India Travel
      </td></tr>
    </table>
  </td></tr>
</table></body></html>`;

const button = (href, label) =>
  `<p style="margin:24px 0;"><a href="${esc(href)}" style="background:${BRAND};color:#fff;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block;font-weight:bold;">${esc(label)}</a></p>`;

const row = (label, value) =>
  `<tr><td style="padding:8px 0;color:#666;width:42%;">${esc(label)}</td><td style="padding:8px 0;font-weight:bold;">${value}</td></tr>`;

const table = (rows) =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #eee;border-bottom:1px solid #eee;margin:16px 0;">${rows.join("")}</table>`;

const itemName = (b) => esc(b.package?.name || b.hotel?.name || (b.bookingType === "hotel" ? "Hotel stay" : "Tour package"));

const bookingRows = (b) => {
  const rows = [row("Booking ID", esc(b.bookingReference)), row("Booked", itemName(b))];
  if (b.bookingType === "hotel") {
    rows.push(row("Check-in", fmtDate(b.checkIn)), row("Check-out", fmtDate(b.checkOut)), row("Rooms", esc(b.numberOfRooms)));
  } else {
    rows.push(row("Travel date", fmtDate(b.travelDate)));
  }
  rows.push(row("Guests", `${esc(b.guests?.adults || 1)} adult(s), ${esc(b.guests?.children || 0)} child(ren)`));
  return rows;
};

const emailTemplates = {
  verifyEmail: (name, url) =>
    layout(
      "Verify your email",
      `<h2 style="margin-top:0;">Hi ${esc(name)},</h2><p>Welcome to India Travel! Please verify your email address to activate your account.</p>${button(url, "Verify Email")}<p style="color:#777;font-size:13px;">This link expires in 24 hours.</p>`,
      "Verify your email address"
    ),

  resetPassword: (name, url) =>
    layout(
      "Reset your password",
      `<h2 style="margin-top:0;">Hi ${esc(name)},</h2><p>We received a request to reset your password. Click below to choose a new one.</p>${button(url, "Reset Password")}<p style="color:#777;font-size:13px;">This link expires in 10 minutes. If you didn't request this, you can safely ignore this email.</p>`,
      "Reset your password"
    ),

  passwordChanged: (name) =>
    layout(
      "Password changed",
      `<h2 style="margin-top:0;">Hi ${esc(name)},</h2><p>Your password was just changed and you were signed out of all devices. If this wasn't you, reset your password immediately and contact support.</p>`,
      "Your password was changed"
    ),

  // Customer: booking confirmed (invoice attached as PDF)
  bookingConfirmation: (name, b) =>
    layout(
      "Booking confirmed",
      `<h2 style="margin-top:0;">Booking confirmed, ${esc(name)}!</h2><p>Your trip is booked. Here are your details:</p>${table([
        ...bookingRows(b),
        row("Total paid", inr(b.pricing?.totalAmount)),
      ])}<p>Your invoice is attached to this email and is also available in your dashboard.</p>${button(`${env.FRONTEND_URL}/bookings/${b._id}`, "View Booking")}<p>Thank you for booking with India Travel. Have a wonderful trip!</p>`,
      `Booking ${b.bookingReference} confirmed`
    ),

  // Customer: payment receipt
  paymentReceipt: (name, b, payment) =>
    layout(
      "Payment receipt",
      `<h2 style="margin-top:0;">Payment received</h2><p>Hi ${esc(name)}, we've received your payment. Thank you!</p>${table([
        row("Booking ID", esc(b.bookingReference)),
        row("Payment ID", esc(payment?.razorpayPaymentId || "-")),
        row("Date", fmtDate(payment?.paidAt || new Date())),
        row("Subtotal", inr(b.pricing?.basePrice)),
        row("Discount", `- ${inr(b.pricing?.discount)}`),
        row("Tax", inr(b.pricing?.tax)),
        row("Amount paid", inr(payment?.amount ?? b.pricing?.totalAmount)),
        row("Status", '<span style="color:#1a7f37;">PAID</span>'),
      ])}`,
      `Receipt for booking ${b.bookingReference}`
    ),

  // Admin: new booking received
  adminNewBooking: (b, customer) =>
    layout(
      "New booking received",
      `<h2 style="margin-top:0;">New booking received</h2>${table([
        ...bookingRows(b),
        row("Customer", `${esc(customer?.name)} (${esc(customer?.email)})`),
        row("Amount", inr(b.pricing?.totalAmount)),
        row("Payment", esc(String(b.paymentStatus).toUpperCase())),
      ])}${button(`${env.FRONTEND_URL}/admin/bookings`, "Open Admin Panel")}`,
      `New booking ${b.bookingReference}`
    ),

  // Customer: cancellation (with refund details)
  bookingCancelled: (name, b, refund) =>
    layout(
      "Booking cancelled",
      `<h2 style="margin-top:0;">Booking cancelled</h2><p>Hi ${esc(name)}, your booking has been cancelled.</p>${table([
        ...bookingRows(b),
        ...(refund && refund.amount > 0
          ? [
              row("Refund amount", inr(refund.amount)),
              row("Refund timeline", "5-7 business days to your original payment method"),
            ]
          : [row("Refund", "No refund applicable under the cancellation policy")]),
      ])}<p>We hope to see you again soon.</p>`,
      `Booking ${b.bookingReference} cancelled`
    ),

  tripReminder: (name, b) =>
    layout(
      "Your trip is almost here",
      `<h2 style="margin-top:0;">Get ready, ${esc(name)}!</h2><p>Your trip starts on <strong>${fmtDate(b.travelDate || b.checkIn)}</strong>.</p>${table(bookingRows(b))}${button(`${env.FRONTEND_URL}/bookings/${b._id}`, "View Booking")}`,
      "Your trip starts soon"
    ),

  bookingExpired: (name, b) =>
    layout(
      "Booking expired",
      `<h2 style="margin-top:0;">Hi ${esc(name)},</h2><p>Your booking <strong>${esc(b.bookingReference)}</strong> was not paid in time and has been released. You can make a new booking any time.</p>${button(`${env.FRONTEND_URL}`, "Browse trips")}`,
      "Your booking hold expired"
    ),

  // Contact form -> admin
  contactMessage: ({ name, email, subject, message }) =>
    layout(
      "New contact message",
      `<h2 style="margin-top:0;">New contact form message</h2>${table([
        row("Name", esc(name)),
        row("Email", esc(email)),
        row("Subject", esc(subject || "New message")),
      ])}<p style="white-space:pre-wrap;">${esc(message)}</p>`,
      "New contact form message"
    ),
};

module.exports = { emailTemplates, esc };
