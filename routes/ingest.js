// routes/ingest.js (CommonJS)
const express = require('express');
const mongoose = require('mongoose');
const { normalizeSeiNumber } = require('../utils/sei');
const Process = require('../models/Process');
const Measurement = require('../models/Measurement');
const Document = require('../models/Document');

const router = express.Router();

// ========== Auth simples por header ==========
function requireApiKey(req, res, next) {
  const incoming = req.header('x-app-token');
  if (!incoming || incoming !== process.env.INGEST_TOKEN) {
    return res.status(401).json({ ok: false, error: 'unauthorized' });
  }
  next();
}

// ========== Helpers ==========
const clean = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();

function safeJSON(str) {
  try { return JSON.parse(str); } catch { return null; }
}

// Remove BOM, zero-width e normaliza quebras
function preClean(raw) {
  let s = String(raw ?? '');

  // decode se veio url-encoded
  try {
    if (/%[0-9A-Fa-f]{2}/.test(s)) {
      const dec = decodeURIComponent(s);
      if ((dec.match(/{/g)||[]).length >= (s.match(/{/g)||[]).length) s = dec;
    }
  } catch {}

  s = s.replace(/^\uFEFF/, '').replace(/\u200B/g, '');
  s = s.replace(/[“”]/g, '"').replace(/[‘’]/g, "'");
  s = s.replace(/\r\n?/g, '\n');
  // remove caracteres de controle NÃO escapados
  s = s.replace(/(?<!\\)[\u0000-\u001F]/g, ' ');
  s = s.replace(/,\s*$/,'').trim();
  return s;
}

// unwrap containers comuns
function unwrapContainer(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj.items)) return obj.items; // { items: [...] }
  if (obj.fields && typeof obj.fields === 'object') return obj.fields;
  if (obj.data && typeof obj.data === 'object') return obj.data;
  if (obj.payload && typeof obj.payload === 'object') return obj.payload;
  return obj;
}

// Converte qualquer coisa em array de objetos
function toArray(input) {
  if (Array.isArray(input)) return input;
  if (input && typeof input === 'object') return [input];
  if (typeof input !== 'string') throw new Error('payload inválido');

  const txt = preClean(input);

  // a) tenta JSON direto
  const parsed = safeJSON(txt);
  if (parsed) return Array.isArray(parsed) ? parsed : [parsed];

  // b) NDJSON
  const lines = txt.split(/\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length > 1 && lines.every(l => l.startsWith('{') && l.endsWith('}'))) {
    const out = [];
    for (const l of lines) { const p = safeJSON(l); if (p) out.push(p); }
    if (out.length) return out;
  }

  // c) sequência "{...},{...}" → embrulha em []
  const wrapped = safeJSON(`[${txt}]`);
  if (wrapped && Array.isArray(wrapped)) return wrapped;

  throw new Error('formato não reconhecido');
}

// Mapeia seus nomes → schema de processes
function mapProcessFields(src) {
  const out = {};

  // diretos
  if (src.seiNumber) out.seiNumber = String(src.seiNumber);
  if (src.title) out.title = String(src.title);
  if (src.subject) out.subject = String(src.subject);
  if (src.status) out.status = String(src.status);
  if (src.unit) out.unit = String(src.unit);
  if (Array.isArray(src.contracts)) out.contracts = src.contracts;

  // legados (seu caso)
  if (!out.seiNumber && (src.processo || src.Processo)) out.seiNumber = String(src.processo || src.Processo);
  if (!out.title && (src.Especificacao || src.especificacao)) out.title = String(src.Especificacao || src.especificacao);
  if (!out.subject && (src.Anotacao || src.anotacao)) out.subject = String(src.Anotacao || src.anotacao);
  if (!out.unit && (src.Atribuicao || src.Atribuicao)) out.unit = String(src.Atribuicao || src.Atribuicao);

  // tags: aceita string ou array
  let tags = src.tags ?? src.Tipo ?? src.tipo;
  if (typeof tags === 'string') {
    tags = tags.split(/[,;]+/).map(s => s.trim()).filter(Boolean);
  }
  if (Array.isArray(tags)) out.tags = tags;

  // ✨ NOVO: diasUltimaMovimentacao (da coluna "Última Mov." do SEI)
  if (src.diasUltimaMovimentacao !== undefined) {
    out.diasUltimaMovimentacao = Number(src.diasUltimaMovimentacao);
  }
  // aceita também nomes alternativos
  if (src.ultimaMovimentacao !== undefined) {
    out.diasUltimaMovimentacao = Number(src.ultimaMovimentacao);
  }
  if (src.UltimaMovimentacao !== undefined) {
    out.diasUltimaMovimentacao = Number(src.UltimaMovimentacao);
  }

  // meta.atribuicao
  const atribuicao = src.Atribuicao ?? src.atribuicao ?? src.assignedTo;
  if (atribuicao) {
    out.meta = out.meta || {};
    out.meta.atribuicao = String(atribuicao);
  }

  // defaults
  if (!out.contracts) out.contracts = [];
  if (!out.tags) out.tags = [];
  if (!out.status) out.status = '';
  if (!out.unit) out.unit = '';
  if (!out.title) out.title = '';
  if (!out.subject) out.subject = '';

  // normaliza SEI
  const { seiNumber, seiNumberNorm } = normalizeSeiNumber(out.seiNumber || '');
  out.seiNumber = seiNumber;
  out.seiNumberNorm = seiNumberNorm;

  return out;
}

// Só grava se houver algo útil (evita esqueletos)
function isMeaningfulProcess(doc) {
  return Boolean(
    (doc.seiNumber && doc.seiNumber.trim()) ||
    doc.title || doc.subject || (doc.tags && doc.tags.length) || doc.unit || doc.status
  );
}

// ========== /upload (application/json) ==========
/**
 * Espera um array JSON ou { items: [...] }
 * Cada item pode conter Process + Documentos + Medições
 */
router.post('/upload', requireApiKey, async (req, res) => {
  try {
    const base = Array.isArray(req.body) ? req.body : (req.body?.items || []);
    if (!Array.isArray(base) || !base.length) {
      return res.status(400).json({ ok: false, error: 'Payload vazio ou inválido' });
    }

    const procOps = [];
    const measOps = [];
    const docOps  = [];

    for (const raw of base) {
      const item = unwrapContainer(raw); // suporta {fields:{...}} também
      const mapped = mapProcessFields(item);
      if (isMeaningfulProcess(mapped)) {
        if (mapped.seiNumber) {
          procOps.push({
            updateOne: {
              filter: { seiNumber: mapped.seiNumber },
              update: { $set: { ...mapped, lastSyncedAt: new Date() } },
              upsert: true
            }
          });
        } else {
          procOps.push({ insertOne: { document: { ...mapped, lastSyncedAt: new Date() } } });
        }
      }

      // ---- Documentos ----
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
                processSei: mapped.seiNumber || '',
                updatedAtSEI: d.updatedAt ? new Date(d.updatedAt) : null,
                lastSyncedAt: new Date()
              }
            },
            upsert: true
          }
        });
      }

      // ---- Medições ----
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
                processSei: mapped.seiNumber || '',
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

// ========== /upload-flex (texto “solto” OU objeto plano) ==========
router.post(
  '/upload-flex',
  requireApiKey,
  // aceita qualquer coisa como texto cru (o app também pode ter express.json globalmente)
  express.text({ type: '*/*', limit: '30mb' }),
  async (req, res) => {
    try {
      // 1) transforma em array
      const arr0 = toArray(req.body);
      // 2) {items:[...]} no nível raiz vira array direto
      const arr1 = arr0.flatMap((x) => {
        const un = unwrapContainer(x);
        return Array.isArray(un) ? un : [un];
      });
      // 3) unwrap de fields/data/payload em cada item
      const items = arr1.map(unwrapContainer);

      if (!items.length) {
        return res.status(400).json({ ok:false, error:'vazio' });
      }

      // 4) mapeia e mantém somente itens úteis
      const mapped = items.map(mapProcessFields).filter(isMeaningfulProcess);
      if (!mapped.length) {
        return res.status(400).json({ ok:false, error:'nenhum item útil após mapeamento' });
      }

      // 5) persiste (update se tiver seiNumber, senão insert)
      const ops = mapped.map((doc) => {
        if (doc.seiNumber) {
          return {
            updateOne: {
              filter: { seiNumber: doc.seiNumber },
              update: { $set: { ...doc, lastSyncedAt: new Date() } },
              upsert: true
            }
          };
        }
        return { insertOne: { document: { ...doc, lastSyncedAt: new Date() } } };
      });

      await Process.bulkWrite(ops, { ordered:false });
      res.json({ ok:true, counts:{ processes: ops.length } });
    } catch (e) {
      console.error('upload-flex erro:', e.message);
      res.status(400).json({ ok:false, error: e.message });
    }
  }
);

module.exports = router;
