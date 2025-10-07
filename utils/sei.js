// utils/sei.js (CommonJS)
function normalizeSeiNumber(raw = '') {
  let s = String(raw).replace(/<\s*wbr\s*>/gi, ''); // tira <wbr>
  s = s.replace(/\s+/g, ' ').trim();               // colapsa espaços
  const seiNumber = s;                             // versão "bonita"
  const seiNumberNorm = s.replace(/[^\d]/g, '');   // só dígitos (índice)
  return { seiNumber, seiNumberNorm };
}

module.exports = { normalizeSeiNumber };
