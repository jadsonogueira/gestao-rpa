// routes/processDocuments.js
const express = require('express');
const { normalizeSeiNumber } = require('../utils/sei');
const ProcessDocument = require('../models/ProcessDocument');
const router = express.Router();

// reutilize o middleware que já existe em ingest.js
function requireApiKey(req, res, next) {
  const key = req.header('x-app-token');
  if (!key || key !== process.env.INGEST_TOKEN) {
    return res.status(401).json({ ok: false, error: 'unauthorized' });
  }
  next();
}

const clean = (s) => String(s ?? '').trim();

router.post(
  '/',
  requireApiKey,
  express.json({ limit: '10mb' }),
  async (req, res) => {
    try {
      const payload = Array.isArray(req.body?.documents)
        ? req.body.documents
        : Array.isArray(req.body)
          ? req.body
          : [];

      if (!payload.length) {
        return res.status(400).json({ ok: false, error: 'payload vazio ou inválido' });
      }

      const ops = [];
      for (const item of payload) {
        const seiNumberRaw = clean(item.seiNumber);
        const docNumberRaw = clean(item.docNumber);

        if (!seiNumberRaw || !docNumberRaw) {
          continue; // ignora registros incompletos
        }

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
        counts: {
          documents: ops.length
        }
      });
    } catch (err) {
      console.error('POST /api/process-documents erro:', err);
      res.status(500).json({ ok: false, error: err.message });
    }
  }
);

module.exports = router;
