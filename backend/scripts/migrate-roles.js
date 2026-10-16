// One-off migration: the platform now has only two roles ("user" and "admin").
//   super_admin            -> admin  (same full management access, simpler name)
//   hotel_manager / agent  -> user
// Existing "admin" and "user" accounts are untouched.
// Usage:  npm run migrate:roles            (dry run - only prints what would change)
//         npm run migrate:roles -- --apply (actually updates the database)
require("dotenv").config();
const mongoose = require("mongoose");
const User = require("../models/user.model");

const APPLY = process.argv.includes("--apply");
const MAP = { super_admin: "admin", hotel_manager: "user", agent: "user" };

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const col = User.collection; // raw collection: bypasses enum validation
  for (const [from, to] of Object.entries(MAP)) {
    const n = await col.countDocuments({ role: from });
    console.log(`${from.padEnd(14)} -> ${to.padEnd(8)} ${n} user(s)`);
    if (APPLY && n) {
      // bump tokenVersion so affected users must log in again with the new role
      await col.updateMany({ role: from }, { $set: { role: to }, $inc: { tokenVersion: 1 } });
    }
  }
  console.log(APPLY ? "Done." : "Dry run only. Re-run with --apply to update.");
  await mongoose.disconnect();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
