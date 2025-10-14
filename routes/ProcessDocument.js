const express = require('express');
const { normalizeSeiNumber } = require('../utils/sei');
const ProcessDocument = require('../models/ProcessDocument');

const router = express.Router();

// Middleware de autenticação (mesmo token do ingest)
function requireApiKey(req, res, next) {
  const key = req.header('x-app-token');
  if (!key || key !== process.env.INGEST_TOKEN) {
    return res.status(401).json({ ok: false, error: 'unauthorized' });
  }
  next();
}

const clean = (s) => String(s ?? '').trim();
const tryJson = (txt) => {
  try { return JSON.parse(txt); } catch (_) { return null; }
};

router.post(
  '/',
  requireApiKey,
  express.text({ type: '*/*', limit: '10mb' }), // aceita text/plain ou application/json
  async (req, res) => {
    try {
      let payload = [];
      const rawBody = req.body;

      if (Array.isArray(rawBody)) {
        payload = rawBody;
      } else if (rawBody && typeof rawBody === 'object') {
        if (Array.isArray(rawBody.documents)) payload = rawBody.documents;
      } else if (typeof rawBody === 'string') {
        const trimmed = rawBody.trim();
        if (trimmed) {
          const parsed = tryJson(trimmed);
          if (parsed) {
            if (Array.isArray(parsed.documents)) payload = parsed.documents;
            else if (Array.isArray(parsed)) payload = parsed;
          }
          if (!payload.length) {
            const wrapped = tryJson(`[${trimmed}]`);
            if (Array.isArray(wrapped)) payload = wrapped;
          }
        }
      }

      if (!payload.length) {
        return res.status(400).json({ ok: false, error: 'payload vazio ou inválido' });
      }

      const ops = [];
      for (const item of payload) {
        if (!item || typeof item !== 'object') continue;

        const seiNumberRaw = clean(item.seiNumber);
        const docNumberRaw = clean(item.docNumber);
        if (!seiNumberRaw || !docNumberRaw) continue;

        const { seiNumber, seiNumberNorm } = normalizeSeiNumber(seiNumberRaw);

        ops.push({
          updateOne: {
            filter: { seiNumberNorm, docNumber: docNumberRaw },
            update: {
              $set: {
                seiNumber,
                seiNumberNorm,
                docNumber: docNumberRaw,
                docTitle: clean(item.docTitle),
                status: clean(item.status),
                documentsUpdatedAt: item.documentsUpdatedAt ? new Date(item.documentsUpdatedAt) : null,
                capturedAt: item.capturedAt ? new Date(item.capturedAt) : null,
                metadata: item.metadata ?? {},
                lastSyncedAt: new Date()
              }
            },
            upsert: true
          }
        });
      }

      if (!ops.length) {
        return res.status(400).json({ ok: false, error: 'nenhum documento válido' });
      }

      await ProcessDocument.bulkWrite(ops, { ordered: false });

      res.json({
        ok: true,
        counts: { documents: ops.length }
      });
    } catch (err) {
      console.error('POST /api/process-documents erro:', err);
      res.status(500).json({ ok: false, error: err.message });
    }
  }
);

module.exports = router;
