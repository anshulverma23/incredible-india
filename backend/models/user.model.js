const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const { ALL_ROLES, ROLES } = require("./roles");

const refreshTokenSchema = new mongoose.Schema(
  {
    tokenHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    userAgent: String,
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, "Name is required"], trim: true, maxlength: 80 },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      index: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Please provide a valid email"],
    },
    password: {
      type: String,
      minlength: 8,
      select: false, // never return password by default
      required: function () {
        return !this.googleId; // password not required for Google OAuth users
      },
    },
    phone: { type: String, trim: true, maxlength: 20 },
    avatar: {
      url: { type: String, default: "" },
      public_id: { type: String, default: "" },
    },
    role: { type: String, enum: ALL_ROLES, default: ROLES.USER, index: true },
    googleId: { type: String, unique: true, sparse: true },

    isEmailVerified: { type: Boolean, default: false },
    emailVerificationToken: String,
    emailVerificationExpire: Date,

    resetPasswordToken: String,
    resetPasswordExpire: Date,

    // Bumping this invalidates every previously issued access token (used on password change/reset, "logout everywhere").
    tokenVersion: { type: Number, default: 0 },
    refreshTokens: { type: [refreshTokenSchema], default: [], select: false },

    isActive: { type: Boolean, default: true },
    lastLoginAt: Date,
  },
  { timestamps: true }
);

userSchema.index({ createdAt: -1 });
userSchema.index({ name: "text", email: "text" });

// Hash password whenever it's set/changed
userSchema.pre("save", async function (next) {
  if (!this.isModified("password") || !this.password) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.matchPassword = async function (enteredPassword) {
  if (!this.password) return false;
  return bcrypt.compare(enteredPassword, this.password);
};

const hashToken = (raw) => crypto.createHash("sha256").update(raw).digest("hex");
userSchema.statics.hashToken = hashToken;

// Generates a random token, stores its SHA-256 hash on the user, returns the raw token (sent via email)
userSchema.methods.createVerificationToken = function () {
  const rawToken = crypto.randomBytes(32).toString("hex");
  this.emailVerificationToken = hashToken(rawToken);
  this.emailVerificationExpire = Date.now() + 24 * 60 * 60 * 1000; // 24h
  return rawToken;
};

userSchema.methods.createResetPasswordToken = function () {
  const rawToken = crypto.randomBytes(32).toString("hex");
  this.resetPasswordToken = hashToken(rawToken);
  this.resetPasswordExpire = Date.now() + 10 * 60 * 1000; // 10 minutes
  return rawToken;
};

userSchema.methods.isAdmin = function () {
  return this.role === ROLES.ADMIN;
};

module.exports = mongoose.model("User", userSchema);
