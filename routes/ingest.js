// routes/ingest.js
import express from "express";
import Process from "../models/Process.js";
import Measurement from "../models/Measurement.js";
import Document from "../models/Document.js";
import { requireApiKey } from "../middleware/apiKey.js";
import { normalizeSeiNumber } from "../utils/sei.js";

const router = express.Router();
router.post("/upload", requireApiKey, async (req, res) => {
  try {
    const payload = Array.isArray(req.body) ? req.body : (req.body.items || []);
    if (!Array.isArray(payload) || !payload.length) {
      return res.status(400).json({ ok: false, error: "Payload vazio ou inválido" });
    }

    const procOps = [], measOps = [], docOps = [];
    for (const item of payload) {
      const rawSei = item.seiNumber || item.processo || item.Processo || "";
      const { seiNumber, seiNumberNorm } = normalizeSeiNumber(rawSei);

      procOps.push({
        updateOne: {
          filter: { seiNumber },
          update: {
            $set: {
              seiNumber, seiNumberNorm,
              title: item.title || item.Assunto || item.subject || "",
              subject: item.subject || item.Assunto || "",
              unit: item.unit || item.Unidade || "",
              status: item.status || "",
              contracts: item.contracts || item.Contratos || [],
              updatedAtSEI: item.updatedAt ? new Date(item.updatedAt) : null,
              createdAtSEI: item.createdAt ? new Date(item.createdAt) : null,
              lastSyncedAt: new Date()
            }
          },
          upsert: true
        }
      });

      for (const d of item.documents || item.Documentos || []) {
        docOps.push({
          updateOne: {
            filter: { seiDocNumber: String(d.seiDocNumber || d.Numero || d.Id), version: Number(d.version || 1) },
            update: {
              $set: {
                seiDocNumber: String(d.seiDocNumber || d.Numero || d.Id),
                name: d.name || d.Nome || "",
                type: d.type || d.Tipo || "",
                version: Number(d.version || 1),
                url: d.url || "",
                hash: d.hash || null,
                updatedAtSEI: d.updatedAt ? new Date(d.updatedAt) : null,
                lastSyncedAt: new Date()
              }
            },
            upsert: true
          }
        });
      }

      for (const m of item.measurements || item.Medicoes || []) {
        measOps.push({
          updateOne: {
            filter: {
              contractNumber: m.contractNumber || m.Contrato,
              medicaoNumber: Number(m.medicaoNumber || m.Medicao)
            },
            update: {
              $set: {
                contractNumber: m.contractNumber || m.Contrato,
                medicaoNumber: Number(m.medicaoNumber || m.Medicao),
                periodStart: m.periodStart ? new Date(m.periodStart) : null,
                periodEnd: m.periodEnd ? new Date(m.periodEnd) : null,
                status: m.status || "",
                totals: {
                  bruto: Number(m?.totals?.bruto || m?.Bruto || 0),
                  deducoes: Number(m?.totals?.deducoes || m?.Deducoes || 0),
                  liquido: Number(m?.totals?.liquido || m?.Liquido || 0),
                },
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

export default router;
