const jwt = require("jsonwebtoken");
const User = require("../../models/user.model");

// Only two roles exist: "user" and "admin" (`legacy` simulates an old, removed role such as hotel_manager).
const ids = { user: "665f1c2e8f1b2c0012345001", admin: "665f1c2e8f1b2c0012345002", legacy: "665f1c2e8f1b2c0012345003" };

const tokenFor = (id, role) => jwt.sign({ id, role, tv: 0 }, process.env.JWT_SECRET, { expiresIn: "5m" });
const fakeUser = (id, role) => ({ _id: id, role, isActive: true, tokenVersion: 0, name: role, email: `${role}@test.dev` });

// Makes `protect` resolve the given user for requests that carry their token.
const mockAuth = () => {
  const users = { [ids.user]: fakeUser(ids.user, "user"), [ids.admin]: fakeUser(ids.admin, "admin"), [ids.legacy]: fakeUser(ids.legacy, "hotel_manager") };
  return jest.spyOn(User, "findById").mockImplementation(async (id) => users[String(id)] || null);
};

const auth = {
  user: () => ({ Authorization: `Bearer ${tokenFor(ids.user, "user")}` }),
  admin: () => ({ Authorization: `Bearer ${tokenFor(ids.admin, "admin")}` }),
  legacy: () => ({ Authorization: `Bearer ${tokenFor(ids.legacy, "hotel_manager")}` }),
};

// Mongoose query-chain stub: every chained method returns the chain, awaiting it yields `result`.
const chain = (result) => {
  const c = {};
  ["populate", "sort", "skip", "limit", "select", "lean", "distinct"].forEach((m) => (c[m] = jest.fn(() => c)));
  c.then = (res, rej) => Promise.resolve(result).then(res, rej);
  return c;
};

module.exports = { ids, tokenFor, mockAuth, auth, chain };
