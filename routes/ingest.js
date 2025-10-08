// routes/ingest.js (CommonJS)
const express = require('express');
const mongoose = require('mongoose');
const { normalizeSeiNumber } = require('../utils/sei');
const Process = require('../models/Process');
const Measurement = require('../models/Measurement');
const Document = require('../models/Document');

const router = express.Router();

// Token simples via header
function requireApiKey(req, res, next) {
  const incoming = req.header('x-app-token');
  if (!incoming || incoming !== process.env.INGEST_TOKEN) {
    return res.status(401).json({ ok: false, error: 'unauthorized' });
  }
  next();
}

// helpers
const clean = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();

// ====== /upload (JSON válido) ======
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

      // ---- Processos (inclui seus novos campos) ----
      procOps.push({
        updateOne: {
          filter: { seiNumber },
          update: {
            $set: {
              seiNumber, seiNumberNorm,

              // << seus campos >>
              assignedTo: clean(item.Atribuicao ?? item.atribuicao ?? item.assignedTo),
              note:       clean(item.Anotacao   ?? item.anotacao   ?? item.note),
              type:       clean(item.Tipo       ?? item.tipo       ?? item.type),
              spec:       clean(item.Especificacao ?? item.especificacao ?? item.spec),

              // legados/gerais (se vierem)
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

      // ---- Documentos (se existir no payload) ----
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
                processSei: seiNumber,
                updatedAtSEI: d.updatedAt ? new Date(d.updatedAt) : null,
                lastSyncedAt: new Date()
              }
            },
            upsert: true
          }
        });
      }

      // ---- Medições (se existir no payload) ----
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
                  bruto:     Number(m?.totals?.bruto    ?? m?.Bruto    ?? 0),
                  deducoes:  Number(m?.totals?.deducoes ?? m?.Deducoes ?? 0),
                  liquido:   Number(m?.totals?.liquido  ?? m?.Liquido  ?? 0)
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

// ====== /upload-flex (texto "solto": {..},{..},{..}) ======

function preClean(raw) {
  let s = String(raw ?? '');

  // tenta decodificar se veio %7B%22...
  try {
    if (/%[0-9A-Fa-f]{2}/.test(s)) {
      const dec = decodeURIComponent(s);
      // só troca se decodificar “aumentar” a quantidade de chaves/aspas (sinal de que estava URL-encoded)
      if ((dec.match(/{/g)||[]).length >= (s.match(/{/g)||[]).length) s = dec;
    }
  } catch {}

  // normaliza aspas “inteligentes” para ASCII
  s = s.replace(/[“”]/g, '"').replace(/[‘’]/g, "'");

  // normaliza CRLF para LF
  s = s.replace(/\r\n?/g, '\n');

  // remove caracteres de controle NÃO escapados (ENTER, TAB etc.) que quebram o JSON
  // Obs.: não mexe nos que já estão escapados (\n, \t)
  s = s.replace(/(?<!\\)[\u0000-\u001F]/g, ' ');

  // remove vírgulas finais soltas
  s = s.replace(/,\s*$/,'').trim();
  return s;
}

function coerceToArray(input) {
  if (Array.isArray(input)) return input;
  if (input && typeof input === 'object') return [input];
  if (typeof input !== 'string') throw new Error('payload inválido');

  const txt0 = input.trim();
  const txt  = preClean(txt0);

  // 1) tenta JSON direto
  try {
    const parsed = JSON.parse(txt);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {}

  // 2) NDJSON (um objeto por linha)
  const lines = txt.split(/\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length > 1 && lines.every(l => l.startsWith('{') && l.endsWith('}'))) {
    const arr = [];
    for (const l of lines) { try { arr.push(JSON.parse(l)); } catch {} }
    if (arr.length) return arr;
  }

  // 3) sequência "{...},{...},{...}" (caso do PA) → embrulha em []
  try {
    const wrapped = `[${txt}]`;
    const arr = JSON.parse(wrapped);
    if (Array.isArray(arr)) return arr;
  } catch (e) {
    // log útil para depurar onde quebrou
    const pos = (e && typeof e.message === 'string' && e.message.match(/position (\d+)/i)) ? Number(RegExp.$1) : null;
    if (Number.isFinite(pos)) {
      const ctx = txt.slice(Math.max(0,pos-40), Math.min(txt.length,pos+40));
      console.error('upload-flex JSON error near position', pos, 'context:', ctx);
    }
    throw e;
  }

  throw new Error('formato não reconhecido');
}

/**
 * POST /api/ingest/upload-flex
 * Headers:
 *  - x-app-token: <INGEST_TOKEN>
 * Content-Type: text/plain
 * Body: texto no formato “{...},{...}”
 */
// ====== /upload-flex (aceita objeto direto ou lista) ======
router.post(
  '/upload-flex',
  requireApiKey,
  express.text({ type: '*/*', limit: '30mb' }),
  async (req, res) => {
    try {
      // 1) transforma qualquer entrada (texto, array, objeto) em array de objetos
      const raw = req.body;
      let arr = [];

      // se já for objeto JSON (por causa de body-parser)
      if (typeof raw === 'object' && raw !== null) {
        arr = Array.isArray(raw) ? raw : [raw];
      } else if (typeof raw === 'string') {
        const txt = preClean(raw);
        // tenta parsear direto como objeto único
        const parsed = safeJSON(txt);
        if (parsed) {
          arr = Array.isArray(parsed) ? parsed : [parsed];
        } else {
          // tenta formato {..},{..}
          const wrapped = safeJSON(`[${txt}]`);
          if (wrapped && Array.isArray(wrapped)) arr = wrapped;
        }
      }

      if (!arr.length) {
        return res.status(400).json({ ok: false, error: 'Formato inválido ou vazio' });
      }

      // 2) converte cada item no formato do schema
      const ops = [];
      for (const item of arr) {
        const rawSei = item.Processo || item.processo || item.seiNumber || '';
        const { seiNumber, seiNumberNorm } = normalizeSeiNumber(rawSei);

        const mapped = {
          seiNumber,
          seiNumberNorm,
          assignedTo: clean(item.Atribuicao ?? item.atribuicao ?? ''),
          note: clean(item.Anotacao ?? item.anotacao ?? ''),
          type: clean(item.Tipo ?? item.tipo ?? ''),
          spec: clean(item.Especificacao ?? item.especificacao ?? ''),
          title: clean(item.title ?? item.Assunto ?? ''),
          subject: clean(item.subject ?? item.Assunto ?? ''),
          unit: clean(item.unit ?? item.Unidade ?? ''),
          status: clean(item.status ?? ''),
          contracts: item.contracts || item.Contratos || [],
          lastSyncedAt: new Date(),
        };

        // só grava se tiver um SEI ou algum conteúdo relevante
        if (
          mapped.seiNumber ||
          mapped.title ||
          mapped.subject ||
          mapped.note ||
          mapped.type ||
          mapped.spec
        ) {
          ops.push({
            updateOne: {
              filter: { seiNumber },
              update: { $set: mapped },
              upsert: true,
            },
          });
        }
      }

      if (!ops.length) {
        return res.status(400).json({ ok: false, error: 'Nenhum item útil encontrado' });
      }

      await Process.bulkWrite(ops, { ordered: false });
      res.json({ ok: true, counts: { processes: ops.length } });
    } catch (e) {
      console.error('upload-flex erro:', e.message);
      res.status(400).json({ ok: false, error: e.message });
    }
  }
);


module.exports = router;
