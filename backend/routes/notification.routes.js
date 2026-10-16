const express = require("express");
const c = require("../controllers/notification.controller");
const { protect } = require("../middlewares/authMiddleware");

const router = express.Router();
router.use(protect);

router.get("/", c.list);
router.put("/read-all", c.markAllRead);
router.put("/:id/read", c.markRead);
router.delete("/:id", c.remove);

module.exports = router;
