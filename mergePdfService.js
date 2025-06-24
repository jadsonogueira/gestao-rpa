const PDFMerger = require('pdf-merger-js');
const path = require('path');
const fs = require('fs');

async function mergePDFs(pdfBuffers) {
  const merger = new PDFMerger();

  for (let buffer of pdfBuffers) {
    await merger.add(buffer); // adiciona diretamente a partir do buffer
  }

  const mergedPdfBuffer = await merger.saveAsBuffer(); // retorna o buffer do PDF final

  return mergedPdfBuffer;
}

module.exports = mergePDFs;
