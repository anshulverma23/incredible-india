const nodemailer = require("nodemailer");
const { env } = require("../config/env");
const logger = require("./logger");
const { emailTemplates } = require("./emailTemplates");

let transporter = null;
const getTransporter = () => {
  if (!env.SMTP_HOST) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      pool: true,
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
    });
  }
  return transporter;
};

/**
 * Sends one email. NEVER throws - email problems must not break a booking/payment flow.
 * Returns true on success. Supports nodemailer `attachments` (used for the PDF invoice).
 */
const sendEmail = async ({ to, subject, html, text, attachments }) => {
  const t = getTransporter();
  if (!t) {
    logger.warn(`Email not sent (SMTP not configured): "${subject}" -> ${to}`);
    return false;
  }
  try {
    await t.sendMail({
      from: env.EMAIL_FROM || `"India Travel" <${env.SMTP_USER}>`,
      to,
      subject,
      html,
      text: text || html.replace(/<style[\s\S]*?<\/style>/g, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
      attachments,
    });
    return true;
  } catch (error) {
    logger.error(`sendEmail failed: ${error.message}`, { to, subject });
    return false;
  }
};

/** Fire-and-forget: used inside request handlers/webhooks so the response isn't delayed by SMTP latency. */
const queueEmail = (payload) => {
  setImmediate(() => {
    sendEmail(payload).catch((e) => logger.error(`queueEmail error: ${e.message}`));
  });
};

module.exports = { sendEmail, queueEmail, emailTemplates };
