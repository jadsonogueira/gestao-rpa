// models/Document.js
const mongoose = require('mongoose');

const DocumentSchema = new mongoose.Schema({
  seiDocNumber: { type: String, index: true },
  name: String,
  type: String,
  version: { type: Number, default: 1 },
  url: String,
  hash: String,
  processSei: String,
  updatedAtSEI: Date,
  lastSyncedAt: Date
}, { timestamps: true });

DocumentSchema.index({ seiDocNumber: 1, version: 1 }, { unique: true });

module.exports = mongoose.model('Document', DocumentSchema);
