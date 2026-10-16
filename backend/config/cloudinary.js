const cloudinary = require("cloudinary").v2;
const multer = require("multer");
const { Readable } = require("stream");
const { env } = require("./env");
const { httpError } = require("../utils/httpError");

cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET,
});

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB per file
const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp"];

// A client can lie about the mimetype/extension, so we also check the real file signature ("magic bytes").
const detectImageType = (buf) => {
  if (!buf || buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buf.slice(0, 4).toString("ascii") === "RIFF" && buf.slice(8, 12).toString("ascii") === "WEBP") return "image/webp";
  return null;
};

// Files are held in memory only briefly, then streamed straight to Cloudinary below -
// nothing touches disk, which keeps this safe on ephemeral hosts like Render/Vercel.
const memoryUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE, files: 10, fields: 60, fieldSize: 200 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME.includes(file.mimetype)) {
      return cb(httpError(400, "Only JPEG, PNG or WebP images are allowed"));
    }
    cb(null, true);
  },
});

const assertRealImages = (files) => {
  for (const f of files) {
    const real = detectImageType(f.buffer);
    if (!real || real !== f.mimetype) throw httpError(400, `"${f.originalname}" is not a valid image file`);
  }
};

const uploadBufferToCloudinary = (buffer, folder) =>
  new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: `india-travel/${folder}`,
        allowed_formats: ["jpg", "jpeg", "png", "webp"],
        transformation: [{ width: 1600, height: 1600, crop: "limit", quality: "auto", fetch_format: "auto" }],
      },
      (error, result) => (error ? reject(error) : resolve(result))
    );
    Readable.from(buffer).pipe(uploadStream);
  });

/**
 * Returns { array(fieldName, maxCount), single(fieldName) } - each gives back an
 * Express middleware chain that parses the multipart upload into memory, validates the real file type,
 * pushes the buffer(s) to Cloudinary, then rewrites req.files/req.file to { path, filename }
 * (secure_url + public_id) so controllers can use them exactly like disk-based multer.
 */
const makeUploader = (folder) => {
  const array = (fieldName, maxCount) => [
    memoryUpload.array(fieldName, maxCount),
    async (req, res, next) => {
      try {
        if (!req.files || req.files.length === 0) return next();
        assertRealImages(req.files);
        const uploaded = await Promise.all(req.files.map((f) => uploadBufferToCloudinary(f.buffer, folder)));
        req.files = uploaded.map((r) => ({ path: r.secure_url, filename: r.public_id }));
        next();
      } catch (err) {
        next(err);
      }
    },
  ];

  const single = (fieldName) => [
    memoryUpload.single(fieldName),
    async (req, res, next) => {
      try {
        if (!req.file) return next();
        assertRealImages([req.file]);
        const result = await uploadBufferToCloudinary(req.file.buffer, folder);
        req.file = { path: result.secure_url, filename: result.public_id };
        next();
      } catch (err) {
        next(err);
      }
    },
  ];

  return { array, single };
};

// Removes an image from Cloudinary given its public_id (used on delete/replace)
const deleteImage = async (publicId) => {
  if (!publicId) return;
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (err) {
    require("../utils/logger").error(`Cloudinary delete error: ${err.message}`);
  }
};

module.exports = { cloudinary, makeUploader, deleteImage, detectImageType, MAX_FILE_SIZE };
