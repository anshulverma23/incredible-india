const asyncHandler = require("express-async-handler");
const { sendEmail, emailTemplates } = require("../utils/sendEmail");
const { env } = require("../config/env");

// @route POST /api/contact   (validated + rate limited in the route)
const sendContactMessage = asyncHandler(async (req, res) => {
  const { name, email, subject, message } = req.body;

  if (!env.ADMIN_NOTIFY_EMAIL) {
    res.status(503);
    throw new Error("Contact email is not configured on the server");
  }

  const delivered = await sendEmail({
    to: env.ADMIN_NOTIFY_EMAIL,
    subject: `[Contact Form] ${subject || "New message"} - from ${name}`.replace(/[\r\n]+/g, " "), // no header injection
    html: emailTemplates.contactMessage({ name, email, subject, message }),
  });

  if (!delivered) {
    res.status(502);
    throw new Error("Could not send your message right now. Please try again later.");
  }
  res.status(200).json({ success: true, message: "Thanks! We'll get back to you soon." });
});

module.exports = { sendContactMessage };
