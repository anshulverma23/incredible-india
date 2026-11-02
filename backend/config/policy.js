// Business rules that are easy to tweak without touching controllers.
// Cancellation refund tiers: the FIRST tier whose `minDaysBefore` is <= days until the trip applies.
const CANCELLATION_TIERS = [
  { minDaysBefore: 7, refundPercent: 90, label: "7+ days before start" },
  { minDaysBefore: 3, refundPercent: 50, label: "3-6 days before start" },
  { minDaysBefore: 0, refundPercent: 0, label: "Less than 3 days before start" },
];

const LIMITS = {
  maxNights: 30,
  maxRoomsPerBooking: 10,
  maxGuestsPerBooking: 30,
  maxAdvanceBookingDays: 540,
};

// Hotel "request booking" flow (hotel owner is contacted by the admin before any payment).
const HOTEL_REQUEST = {
  requestExpiryHours: 72, // admin has this long to answer a new request
  defaultQuoteValidityHours: 24, // how long the final price stays valid for the customer
  maxQuoteValidityHours: 72,
};

// Package "Discuss & Customize" flow: enquiry -> discussion -> quotation -> customer approval -> payment.
const PACKAGE_ENQUIRY = {
  defaultQuoteValidityDays: 7, // how long a quotation stays valid
  maxQuoteValidityDays: 30,
  paymentWindowHours: 48, // after the customer accepts, time to make the first payment
  balanceDueDaysBeforeTrip: 7, // advance plan: the balance is due this many days before the trip starts
  minAdvancePercent: 10,
  maxAdvancePercent: 90,
};

module.exports = { CANCELLATION_TIERS, LIMITS, HOTEL_REQUEST, PACKAGE_ENQUIRY };
