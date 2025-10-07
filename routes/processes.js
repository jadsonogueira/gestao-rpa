// routes/processes.js
const express = require('express');
const Process = require('../models/Process');

const router = express.Router();

/**
 * GET /api/processes?search=&unit=&status=&contract=&page=1&limit=50
 */
router.get('/', async (req, res) => {
  try {
    const { search = '', unit, status, contract, page = 1, limit = 20 } = req.query;
    const q = {};
    if (search) q.$text = { $search: String(search) };
    if (unit)   q.unit = String(unit);
    if (status) q.status = String(status);
    if (contract) q.contracts = String(contract);

    const skip = (Number(page) - 1) * Number(limit);
    const [items, total] = await Promise.all([
      Process.find(q).sort({ updatedAtSEI: -1, updatedAt: -1 }).skip(skip).limit(Number(limit)),
      Process.countDocuments(q)
    ]);

    res.json({ items, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

module.exports = router;
