// One-off migration: give every EXISTING package a slug (new packages get one automatically on create).
// Usage:  npm run migrate:slugs            (dry run - only prints what would change)
//         npm run migrate:slugs -- --apply (actually updates the database)
require("dotenv").config();
const mongoose = require("mongoose");
const Package = require("../models/package.model");
const { generateUniqueSlug } = require("../utils/slugify");

const APPLY = process.argv.includes("--apply");

(async () => {
  await mongoose.connect(process.env.MONGO_URI);

  // raw collection: also finds docs where slug is missing, null or ""
  const col = Package.collection;
  const missing = await col
    .find({ $or: [{ slug: { $exists: false } }, { slug: null }, { slug: "" }] })
    .project({ name: 1 })
    .toArray();

  console.log(`${missing.length} package(s) without a slug`);

  const reserved = new Set();
  for (const doc of missing) {
    const slug = await generateUniqueSlug(Package, doc.name, {
      excludeId: doc._id,
      fallback: `package-${String(doc._id).slice(-6)}`,
      reserved,
    });
    reserved.add(slug);

    console.log(`${String(doc._id)}  "${doc.name}"  ->  /packages/${slug}`);
    if (APPLY) await col.updateOne({ _id: doc._id }, { $set: { slug } });
  }

  console.log(APPLY ? "Done." : "Dry run only. Re-run with --apply to update.");
  await mongoose.disconnect();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
