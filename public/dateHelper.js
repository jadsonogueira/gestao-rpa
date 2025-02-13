// dateHelper.js

/**
 * Converte uma data no formato yyyy-mm-dd para dd/mm/yyyy
 * @param {string} dataISO - Data no formato yyyy-mm-dd
 * @returns {string} - Data no formato dd/mm/yyyy
 */
export function converteDataParaBr(dataISO) {
  if (!dataISO) return '';
  
  const [yyyy, mm, dd] = dataISO.split('-');
  return `${dd}/${mm}/${yyyy}`;
}
