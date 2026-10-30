// One-off migration: give every EXISTING destination a slug (new destinations get one automatically on create).
// Usage:  npm run migrate:destination-slugs            (dry run - only prints what would change)
//         npm run migrate:destination-slugs -- --apply (actually updates the database)
require("dotenv").config();
const mongoose = require("mongoose");
const Destination = require("../models/destination.model");
const { generateUniqueSlug } = require("../utils/slugify");

const APPLY = process.argv.includes("--apply");

(async () => {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) throw new Error("MongoDB connection URI not found in .env");
  await mongoose.connect(uri);

  // raw collection: also finds docs where slug is missing, null or ""
  const col = Destination.collection;
  const missing = await col
    .find({ $or: [{ slug: { $exists: false } }, { slug: null }, { slug: "" }] })
    .project({ name: 1 })
    .toArray();

  console.log(`${missing.length} destination(s) without a slug`);

  const reserved = new Set();
  for (const doc of missing) {
    const slug = await generateUniqueSlug(Destination, doc.name, {
      excludeId: doc._id,
      fallback: `destination-${String(doc._id).slice(-6)}`,
      reserved,
    });
    reserved.add(slug);

    console.log(`${String(doc._id)}  "${doc.name}"  ->  /destinations/${slug}`);
    if (APPLY) await col.updateOne({ _id: doc._id }, { $set: { slug } });
  }

  console.log(APPLY ? "Done." : "Dry run only. Re-run with --apply to update.");
  await mongoose.disconnect();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
