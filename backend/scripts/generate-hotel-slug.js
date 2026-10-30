
require("dotenv").config();

const mongoose = require("mongoose");
const Hotel = require("../models/hotel.model");

const generateSlug = (name) => {
  return (
    String(name || "")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "hotel"
  );
};

async function migrateHotelSlugs() {
  try {
    const mongoUri =
      process.env.MONGODB_URI || process.env.MONGO_URI;

    if (!mongoUri) {
      throw new Error("MongoDB connection URI not found in .env");
    }

    await mongoose.connect(mongoUri);

    console.log("MongoDB connected");

    const hotels = await Hotel.find({
      $or: [
        { slug: { $exists: false } },
        { slug: null },
        { slug: "" },
      ],
    }).select("_id name slug");

    console.log(`Found ${hotels.length} hotels without slugs`);

    let updated = 0;

    for (const hotel of hotels) {
      const baseSlug = generateSlug(hotel.name);

      let slug = baseSlug;
      let count = 1;

      while (await Hotel.exists({ slug })) {
        count += 1;
        slug = `${baseSlug}-${count}`;
      }

      await Hotel.updateOne(
        { _id: hotel._id },
        { $set: { slug } }
      );

      updated++;

      console.log(`${hotel.name} -> ${slug}`);
    }

    console.log(`Migration completed. Updated: ${updated}`);
  } catch (error) {
    console.error("Hotel slug migration failed:", error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

migrateHotelSlugs();
