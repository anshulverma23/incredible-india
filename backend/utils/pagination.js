// Parses ?page=&limit= safely: positive integers, capped limit (prevents ?limit=100000 abuse).
const parsePagination = (query = {}, { defaultLimit = 12, maxLimit = 100 } = {}) => {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(maxLimit, Math.max(1, parseInt(query.limit, 10) || defaultLimit));
  return { page, limit, skip: (page - 1) * limit };
};

const paginationMeta = ({ page, limit }, total) => ({
  page,
  pages: Math.max(1, Math.ceil(total / limit)),
  total,
});

module.exports = { parsePagination, paginationMeta };
