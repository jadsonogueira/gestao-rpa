// models/ProcessDocument.js
const mongoose = require('mongoose');
const normalize = require('../utils/sei').normalizeSeiNumber;

const schema = new mongoose.Schema(
  {
    seiNumber: { type: String, required: true },
    seiNumberNorm: { type: String, required: true },
    docNumber: { type: String, required: true },
    docTitle: { type: String, default: '' },
    status: { type: String, default: '' },
    documentsUpdatedAt: { type: Date },
    capturedAt: { type: Date },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    lastSyncedAt: { type: Date, default: Date.now }
  },
  {
    collection: 'processDocuments',
    timestamps: true // createdAt / updatedAt automáticos
  }
);

// chave única por processo + documento
schema.index({ seiNumberNorm: 1, docNumber: 1 }, { unique: true });

// normaliza antes de salvar
schema.pre('validate', function (next) {
  const { seiNumber, seiNumberNorm } = normalize(this.seiNumber || '');
  this.seiNumber = seiNumber;
  this.seiNumberNorm = seiNumberNorm;
  next();
});

module.exports = mongoose.model('ProcessDocument', schema);
