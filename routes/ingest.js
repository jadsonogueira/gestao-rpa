// routes/ingest.js (CommonJS)
const express = require('express');
const mongoose = require('mongoose');
const { normalizeSeiNumber } = require('../utils/sei');
const Process = require('../models/Process');
const Measurement = require('../models/Measurement');
const Document = require('../models/Document');

const router = express.Router();

// middleware simples de token via header x-app-token
function requireApiKey(req, res, next) {
  const incoming = req.header('x-app-token');
  if (!incoming || incoming !== process.env.INGEST_TOKEN) {
    return res.status(401).json({ ok: false, error: 'unauthorized' });
  }
  next();
}

/**
 * Espera um array JSON ou { items: [...] }
 * Cada item pode conter Process + Documentos + Medições
 */
router.post('/upload', requireApiKey, async (req, res) => {
  try {
    const payload = Array.isArray(req.body) ? req.body : (req.body.items || []);
    if (!Array.isArray(payload) || !payload.length) {
      return res.status(400).json({ ok: false, error: 'Payload vazio ou inválido' });
    }

    const procOps = [];
    const measOps = [];
    const docOps  = [];

    for (const item of payload) {
      const rawSei = item.seiNumber || item.processo || item.Processo || '';
      const { seiNumber, seiNumberNorm } = normalizeSeiNumber(rawSei);

      procOps.push({
        updateOne: {
          filter: { seiNumber },
          update: {
            $set: {
              seiNumber, seiNumberNorm,
              title:   item.title   || item.Assunto || item.subject || '',
              subject: item.subject || item.Assunto || '',
              unit:    item.unit    || item.Unidade || '',
              status:  item.status  || '',
              contracts: item.contracts || item.Contratos || [],
              updatedAtSEI: item.updatedAt ? new Date(item.updatedAt) : null,
              createdAtSEI: item.createdAt ? new Date(item.createdAt) : null,
              lastSyncedAt: new Date()
            }
          },
          upsert: true
        }
      });

      // Documentos
      for (const d of (item.documents || item.Documentos || [])) {
        docOps.push({
          updateOne: {
            filter: {
              seiDocNumber: String(d.seiDocNumber || d.Numero || d.Id),
              version: Number(d.version || 1)
            },
            update: {
              $set: {
                seiDocNumber: String(d.seiDocNumber || d.Numero || d.Id),
                name: d.name || d.Nome || '',
                type: d.type || d.Tipo || '',
                version: Number(d.version || 1),
                url: d.url || '',
                hash: d.hash || null,
                processSei: seiNumber, // referência rápida
                updatedAtSEI: d.updatedAt ? new Date(d.updatedAt) : null,
                lastSyncedAt: new Date()
              }
            },
            upsert: true
          }
        });
      }

      // Medições
      for (const m of (item.measurements || item.Medicoes || [])) {
        const contractNumber = m.contractNumber || m.Contrato;
        const medicaoNumber  = Number(m.medicaoNumber || m.Medicao);
        if (!contractNumber || !Number.isFinite(medicaoNumber)) continue;

        measOps.push({
          updateOne: {
            filter: { contractNumber, medicaoNumber },
            update: {
              $set: {
                contractNumber, medicaoNumber,
                periodStart: m.periodStart ? new Date(m.periodStart) : null,
                periodEnd:   m.periodEnd   ? new Date(m.periodEnd)   : null,
                status: m.status || '',
                totals: {
                  bruto:     Number(m?.totals?.bruto    || m?.Bruto    || 0),
                  deducoes:  Number(m?.totals?.deducoes || m?.Deducoes || 0),
                  liquido:   Number(m?.totals?.liquido  || m?.Liquido  || 0)
                },
                processSei: seiNumber,
                updatedAtSEI: m.updatedAt ? new Date(m.updatedAt) : null,
                lastSyncedAt: new Date()
              }
            },
            upsert: true
          }
        });
      }
    }

    if (procOps.length) await Process.bulkWrite(procOps, { ordered: false });
    if (docOps.length)  await Document.bulkWrite(docOps, { ordered: false });
    if (measOps.length) await Measurement.bulkWrite(measOps, { ordered: false });

    res.json({
      ok: true,
      counts: {
        processes: procOps.length,
        documents: docOps.length,
        measurements: measOps.length
      }
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

module.exports = router;
