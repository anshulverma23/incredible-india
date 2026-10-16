const asyncHandler = require("express-async-handler");
const User = require("../models/user.model");
const Booking = require("../models/booking.model");
const { deleteImage } = require("../config/cloudinary");
const { parsePagination, paginationMeta } = require("../utils/pagination");
const { safeRegex } = require("../utils/escapeRegex");
const logger = require("../utils/logger");

// @route GET /api/users/profile
const getProfile = asyncHandler(async (req, res) => {
  res.status(200).json({ success: true, user: req.user });
});

// @route PUT /api/users/profile  (name, phone, avatar only - never role/email/etc.)
const updateProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);

  if (req.body.name) user.name = String(req.body.name).trim().slice(0, 80);
  if (req.body.phone !== undefined) user.phone = String(req.body.phone).trim().slice(0, 20);

  if (req.file) {
    if (user.avatar?.public_id) await deleteImage(user.avatar.public_id);
    user.avatar = { url: req.file.path, public_id: req.file.filename };
  }

  await user.save();
  res.status(200).json({ success: true, user });
});

// @route GET /api/users?search=&role=&page=&limit=   (admin)
const getAllUsers = asyncHandler(async (req, res) => {
  const { search, role } = req.query;
  const p = parsePagination(req.query, { defaultLimit: 20 });
  const query = {};
  if (role) query.role = role;
  if (search) {
    const rx = safeRegex(search);
    query.$or = [{ name: rx }, { email: rx }];
  }

  const [users, total] = await Promise.all([
    User.find(query).sort({ createdAt: -1 }).skip(p.skip).limit(p.limit).lean(),
    User.countDocuments(query),
  ]);
  res.status(200).json({ success: true, count: users.length, ...paginationMeta(p, total), users });
});

// @route PUT /api/users/:id   (admin)  role / active status
const updateUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }

  const actor = req.user;
  const isSelf = String(actor._id) === String(user._id);
  const { role, isActive } = req.body;

  if (role !== undefined && role !== user.role) {
    if (isSelf) {
      res.status(400);
      throw new Error("You cannot change your own role");
    }
    logger.info(`Role change: ${user.email} ${user.role} -> ${role} by ${actor.email}`);
    user.role = role;
    user.tokenVersion += 1; // force re-login so the new role takes effect immediately
  }

  if (isActive !== undefined) {
    if (isSelf && !isActive) {
      res.status(400);
      throw new Error("You cannot deactivate your own account");
    }
    user.isActive = isActive;
    if (!isActive) user.tokenVersion += 1;
  }

  await user.save();
  res.status(200).json({ success: true, user });
});

// @route DELETE /api/users/:id   (admin)
const deleteUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }
  if (String(user._id) === String(req.user._id)) {
    res.status(400);
    throw new Error("You cannot delete your own account");
  }
  // Bookings/payments must keep a valid owner for accounting + invoices -> deactivate instead of deleting
  if (await Booking.exists({ user: user._id })) {
    res.status(409);
    throw new Error("This user has bookings and can't be deleted. Deactivate the account instead.");
  }
  if (user.avatar?.public_id) await deleteImage(user.avatar.public_id);
  await user.deleteOne();
  res.status(200).json({ success: true, message: "User deleted successfully" });
});

module.exports = { getProfile, updateProfile, getAllUsers, updateUser, deleteUser };
