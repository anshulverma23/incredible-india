const asyncHandler = require("express-async-handler");
const enquiryService = require("../services/enquiry.service");

const ok = (res, data, status = 200) => res.status(status).json({ success: true, ...data });

/* ---------------- customer ---------------- */
// @route POST /api/enquiries
const create = asyncHandler(async (req, res) => {
  const enquiry = await enquiryService.createEnquiry(req.user, req.body);
  ok(res, { message: "Enquiry sent. Our team will contact you soon.", enquiry }, 201);
});

// @route GET /api/enquiries/my
const listMine = asyncHandler(async (req, res) => ok(res, { enquiries: await enquiryService.listMine(req.user) }));

// @route GET /api/enquiries/:id
const getMine = asyncHandler(async (req, res) => ok(res, { enquiry: await enquiryService.getForUser(req.user, req.params.id) }));

// @route POST /api/enquiries/:id/messages   (customer)  |  POST /api/enquiries/admin/:id/messages (admin)
const message = asyncHandler(async (req, res) => ok(res, { enquiry: await enquiryService.addMessage(req.user, req.params.id, req.body.text) }, 201));

// @route PUT /api/enquiries/:id/accept
const accept = asyncHandler(async (req, res) => {
  const { enquiry, booking } = await enquiryService.acceptQuotation(req.user, req.params.id, req.body);
  ok(res, { message: "Quotation accepted. Please complete the payment.", enquiry, booking });
});

// @route PUT /api/enquiries/:id/request-revision
const requestRevision = asyncHandler(async (req, res) => ok(res, { message: "Your change request was sent.", enquiry: await enquiryService.requestRevision(req.user, req.params.id, req.body.note) }));

// @route PUT /api/enquiries/:id/counter-offer
const counterOffer = asyncHandler(async (req, res) => ok(res, { message: "Your offer was sent.", enquiry: await enquiryService.counterOffer(req.user, req.params.id, req.body) }));

// @route PUT /api/enquiries/:id/cancel
const cancel = asyncHandler(async (req, res) => ok(res, { message: "Enquiry cancelled", enquiry: await enquiryService.cancelEnquiry(req.user, req.params.id, req.body.reason) }));

/* ---------------- admin ---------------- */
// @route GET /api/enquiries/admin
const adminList = asyncHandler(async (req, res) => ok(res, await enquiryService.adminList(req.query)));

// @route GET /api/enquiries/admin/stats
const adminStats = asyncHandler(async (req, res) => ok(res, await enquiryService.adminStats()));

// @route GET /api/enquiries/admin/:id
const adminGet = asyncHandler(async (req, res) => ok(res, { enquiry: await enquiryService.getForAdmin(req.user, req.params.id) }));

// @route POST /api/enquiries/admin/:id/quotation
const sendQuotation = asyncHandler(async (req, res) => ok(res, { message: "Quotation sent to the customer", enquiry: await enquiryService.sendQuotation(req.user, req.params.id, req.body) }));

// @route PUT /api/enquiries/admin/:id/counter-offer
const decideCounter = asyncHandler(async (req, res) => ok(res, { message: "Response sent to the customer", enquiry: await enquiryService.decideCounterOffer(req.user, req.params.id, req.body) }));

// @route PUT /api/enquiries/admin/:id/status
const adminStatus = asyncHandler(async (req, res) => ok(res, { message: "Enquiry updated", enquiry: await enquiryService.setAdminStatus(req.user, req.params.id, req.body) }));

// @route POST /api/enquiries/admin/:id/notes
const addNote = asyncHandler(async (req, res) => ok(res, { adminNotes: await enquiryService.addNote(req.user, req.params.id, req.body.note) }, 201));

module.exports = { create, listMine, getMine, message, accept, requestRevision, counterOffer, cancel, adminList, adminStats, adminGet, sendQuotation, decideCounter, adminStatus, addNote };
