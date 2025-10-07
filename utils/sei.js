// utils/sei.js
export function normalizeSeiNumber(raw = "") {
  let s = String(raw).replace(/<\s*wbr\s*>/gi, "");
  s = s.replace(/\s+/g, " ").trim();
  const seiNumber = s;
  const seiNumberNorm = s.replace(/[^\d]/g, "");
  return { seiNumber, seiNumberNorm };
}
