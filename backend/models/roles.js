// Single source of truth for role names (used by the User model and the authorization middleware).
// The platform has exactly two kinds of account: a normal customer ("user") and an "admin" (full management access).
const ROLES = Object.freeze({
  USER: "user",
  ADMIN: "admin",
});

const ALL_ROLES = Object.values(ROLES);
const ADMIN_ROLES = [ROLES.ADMIN];

module.exports = { ROLES, ALL_ROLES, ADMIN_ROLES };
