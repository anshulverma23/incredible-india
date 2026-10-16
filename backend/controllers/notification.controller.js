const asyncHandler = require("express-async-handler");
const Notification = require("../models/notification.model");
const { parsePagination, paginationMeta } = require("../utils/pagination");

// @route GET /api/notifications?unread=true&page=&limit=
const list = asyncHandler(async (req, res) => {
  const p = parsePagination(req.query, { defaultLimit: 20 });
  const q = { user: req.user._id };
  if (req.query.unread === "true") q.isRead = false;
  const [notifications, total, unreadCount] = await Promise.all([
    Notification.find(q).sort({ createdAt: -1 }).skip(p.skip).limit(p.limit).lean(),
    Notification.countDocuments(q),
    Notification.countDocuments({ user: req.user._id, isRead: false }),
  ]);
  res.status(200).json({ success: true, unreadCount, ...paginationMeta(p, total), notifications });
});

// @route PUT /api/notifications/:id/read
const markRead = asyncHandler(async (req, res) => {
  const n = await Notification.findOneAndUpdate({ _id: req.params.id, user: req.user._id }, { isRead: true }, { new: true });
  if (!n) {
    res.status(404);
    throw new Error("Notification not found");
  }
  res.status(200).json({ success: true, notification: n });
});

// @route PUT /api/notifications/read-all
const markAllRead = asyncHandler(async (req, res) => {
  await Notification.updateMany({ user: req.user._id, isRead: false }, { isRead: true });
  res.status(200).json({ success: true });
});

// @route DELETE /api/notifications/:id
const remove = asyncHandler(async (req, res) => {
  await Notification.deleteOne({ _id: req.params.id, user: req.user._id });
  res.status(200).json({ success: true });
});

module.exports = { list, markRead, markAllRead, remove };
