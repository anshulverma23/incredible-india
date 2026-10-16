// Pure pricing helpers - no DB access, so they're trivially unit-testable.
const { env } = require("../config/env");

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const startOfDay = (d) => {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x;
};

const nightsBetween = (checkIn, checkOut) =>
  Math.round((startOfDay(checkOut) - startOfDay(checkIn)) / MS_PER_DAY);

// Money is always whole rupees (integers) to avoid floating point drift.
const calculatePricing = ({ basePrice, discount = 0, taxRate = env.TAX_RATE }) => {
  const base = Math.round(basePrice);
  const disc = Math.min(Math.round(discount), base);
  const taxable = base - disc;
  const tax = Math.round(taxable * taxRate);
  return { basePrice: base, discount: disc, tax, totalAmount: taxable + tax };
};

module.exports = { calculatePricing, nightsBetween, startOfDay, MS_PER_DAY };
