// routes/processes.js
const express = require('express');
const Process = require('../models/Process');

const router = express.Router();

/**
 * GET /api/processes
 * Query:
 *  - search: texto livre (procura em seiNumber, assignedTo, type, spec, note, title, subject)
 *  - unit, status, contract (filtros opcionais)
 *  - page (1..N)
 *  - limit (1..200)
 */
router.get('/', async (req, res) => {
  try {
    const {
      search = '',
      unit,
      status,
      contract,
      page = 1,
      limit = 20
    } = req.query;

    // Sanitização e controle de limites
    const p = Math.max(1, parseInt(page, 10) || 1);
    const l = Math.min(200, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (p - 1) * l;

    // Filtros
    const q = {};
    if (unit)     q.unit = String(unit);
    if (status)   q.status = String(status);
    if (contract) q.contracts = String(contract);

    // Busca livre — regex segura (sem precisar de índice $text)
    if (search) {
      const rx = new RegExp(
        String(search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
        'i'
      );
      q.$or = [
        { seiNumber: rx },
        { assignedTo: rx },
        { type: rx },
        { spec: rx },
        { note: rx },
        { title: rx },
        { subject: rx }
      ];
    }

    // Consulta e contagem em paralelo
    const [items, total] = await Promise.all([
      Process.find(q)
        .sort({ lastSyncedAt: -1, updatedAtSEI: -1, _id: -1 })
        .skip(skip)
        .limit(l)
        .lean(),
      Process.countDocuments(q)
    ]);

    res.json({
      ok: true,
      total,
      page: p,
      pages: Math.ceil(total / l),
      items
    });
  } catch (e) {
    console.error('Erro em GET /api/processes:', e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

module.exports = router;
