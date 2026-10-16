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

module.exports = { CANCELLATION_TIERS, LIMITS };
