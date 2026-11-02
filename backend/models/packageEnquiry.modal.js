const mongoose = require("mongoose");
const crypto = require("crypto");

// new              customer sent the enquiry, admin has not answered yet
// in_discussion    admin and customer are talking / negotiating
// quotation_sent   admin sent a final quotation, waiting for the customer
// revision_requested  customer asked for changes to the quotation
// counter_offered  customer proposed a different price
// accepted         customer accepted -> a booking was created and waits for payment
// booked           (advance or full) payment received -> booking confirmed
// rejected         admin closed the enquiry     cancelled  customer withdrew
const ENQUIRY_STATUSES = ["new", "in_discussion", "quotation_sent", "revision_requested", "counter_offered", "accepted", "booked", "rejected", "cancelled"];
const OPEN_STATUSES = ["new", "in_discussion", "quotation_sent", "revision_requested", "counter_offered", "accepted"];
const CONTACT_METHODS = ["email", "phone", "whatsapp", "chat"];

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I - easy to read over the phone
const generateEnquiryNumber = () => {
  const bytes = crypto.randomBytes(6);
  let out = "";
  for (let i = 0; i < 6; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return `ENQ-${out}`;
};

const itineraryDaySchema = new mongoose.Schema({ day: { type: Number, required: true }, title: { type: String, required: true, maxlength: 150 }, description: { type: String, maxlength: 1500 } }, { _id: false });

const hotelStaySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, maxlength: 150 },
    location: { type: String, maxlength: 120 },
    nights: { type: Number, min: 0, max: 60 },
    roomType: { type: String, maxlength: 80 },
    mealPlan: { type: String, maxlength: 80 },
  },
  { _id: false }
);

// One entry in the conversation timeline (chat messages + important events).
const messageSchema = new mongoose.Schema(
  {
    sender: { type: String, enum: ["customer", "admin", "system"], required: true },
    kind: { type: String, enum: ["message", "quotation", "revision_request", "counter_offer", "counter_response", "status"], default: "message" },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    text: { type: String, required: true, maxlength: 2000 },
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

// The admin's offer. `amount` is the package price BEFORE GST; totalAmount includes GST.
const quotationSchema = new mongoose.Schema(
  {
    version: { type: Number, default: 1 },
    amount: { type: Number, required: true, min: 1 },
    tax: { type: Number, default: 0 },
    totalAmount: { type: Number, required: true },
    perPerson: { type: Number }, // amount / travellers (before GST) - for display
    travellers: { type: Number },
    days: Number,
    nights: Number,
    itinerary: { type: [itineraryDaySchema], default: [] },
    hotels: { type: [hotelStaySchema], default: [] },
    activities: { type: [String], default: [] },
    transport: { type: String, maxlength: 500 },
    inclusions: { type: [String], default: [] },
    exclusions: { type: [String], default: [] },
    note: { type: String, maxlength: 2000 },
    // How the customer may pay: always in full, optionally an advance now + balance before the trip.
    advanceAllowed: { type: Boolean, default: false },
    advancePercent: { type: Number, min: 1, max: 99 },
    validUntil: { type: Date },
    sentAt: { type: Date },
    sentBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { _id: false }
);

const statusHistorySchema = new mongoose.Schema({ status: String, at: { type: Date, default: Date.now }, by: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, note: String }, { _id: false });

const adminNoteSchema = new mongoose.Schema({ note: { type: String, required: true, maxlength: 1000 }, by: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, at: { type: Date, default: Date.now } }, { _id: false });

const enquirySchema = new mongoose.Schema(
  {
    enquiryNumber: { type: String, unique: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    package: { type: mongoose.Schema.Types.ObjectId, ref: "Package", required: true, index: true },

    // What the customer asked for
    request: {
      startDate: { type: Date, required: true },
      adults: { type: Number, required: true, min: 1, max: 30 },
      children: { type: Number, default: 0, min: 0, max: 30 },
      days: { type: Number, min: 1, max: 60 },
      rooms: { type: Number, default: 1, min: 1, max: 15 },
      budget: {
        amount: { type: Number, min: 0 },
        basis: { type: String, enum: ["per_person", "total"], default: "per_person" }, // NOT named "type": mongoose reserves that key
      },
      requirements: { type: String, maxlength: 2000 },
      contactMethod: { type: String, enum: CONTACT_METHODS, default: "email" },
      phone: { type: String, maxlength: 20 },
    },

    status: { type: String, enum: ENQUIRY_STATUSES, default: "new", index: true },
    statusHistory: { type: [statusHistorySchema], default: [] },
    messages: { type: [messageSchema], default: [] },

    quotation: { type: quotationSchema }, // the current offer
    quotationHistory: { type: [quotationSchema], default: [] }, // earlier versions

    // Customer's price proposal on the current quotation (amount is BEFORE GST, same basis as quotation.amount)
    counterOffer: {
      amount: { type: Number, min: 1 },
      note: { type: String, maxlength: 500 },
      at: Date,
      status: { type: String, enum: ["pending", "accepted", "rejected", "superseded"] },
      respondedAt: Date,
    },

    paymentOption: { type: String, enum: ["full", "advance"] }, // what the customer chose when accepting
    booking: { type: mongoose.Schema.Types.ObjectId, ref: "Booking", index: true },
    acceptedAt: Date,
    bookedAt: Date,

    adminNotes: { type: [adminNoteSchema], default: [], select: false }, // internal, never sent to customers
    lastMessageBy: { type: String, enum: ["customer", "admin", "system"], default: "customer" },
    lastActivityAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);

enquirySchema.index({ user: 1, createdAt: -1 });
enquirySchema.index({ status: 1, lastActivityAt: -1 });

enquirySchema.pre("validate", function (next) {
  if (!this.enquiryNumber) this.enquiryNumber = generateEnquiryNumber();
  next();
});

enquirySchema.methods.setStatus = function (status, { by, note } = {}) {
  this.status = status;
  this.statusHistory.push({ status, by, note, at: new Date() });
};

enquirySchema.methods.addMessage = function ({ sender, kind = "message", user, text }) {
  this.messages.push({ sender, kind, user, text, at: new Date() });
  this.lastMessageBy = sender;
  this.lastActivityAt = new Date();
};

enquirySchema.statics.STATUSES = ENQUIRY_STATUSES;
enquirySchema.statics.OPEN_STATUSES = OPEN_STATUSES;
enquirySchema.statics.CONTACT_METHODS = CONTACT_METHODS;

module.exports = mongoose.model("PackageEnquiry", enquirySchema);
