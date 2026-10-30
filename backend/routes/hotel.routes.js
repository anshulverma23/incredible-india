const express = require("express");
const c = require("../controllers/hotel.controller");
const r = require("../controllers/room.controller");
const { protect } = require("../middlewares/authMiddleware");
const { admin, hotelStaff } = require("../middlewares/adminMiddleware");
const { makeUploader } = require("../config/cloudinary");

const router = express.Router();
const uploadHotelImages = makeUploader("hotels");
const uploadRoomImages = makeUploader("rooms");

router.get("/", c.getHotels);
router.post("/", protect, admin, uploadHotelImages.array("images", 8), c.createHotel);

router.get("/:id", c.getHotelById);
router.put("/:id", protect, hotelStaff, uploadHotelImages.array("images", 8), c.updateHotel);
router.delete("/:id", protect, admin, c.deleteHotel);

router.get("/:id/availability", c.checkAvailability);
router.get("/:id/owner-contact", protect, admin, c.getOwnerContact);

// Rooms (nested)
router.get("/:hotelId/rooms", r.getRoomsByHotel);
router.post("/:hotelId/rooms", protect, hotelStaff, uploadRoomImages.array("images", 6), r.createRoom);
router.put("/:hotelId/rooms/:roomId", protect, hotelStaff, uploadRoomImages.array("images", 6), r.updateRoom);
router.delete("/:hotelId/rooms/:roomId", protect, hotelStaff, r.deleteRoom);

module.exports = router;
