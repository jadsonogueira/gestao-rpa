// models/Process.js (CommonJS)
const mongoose = require('mongoose');

const ProcessSchema = new mongoose.Schema({
  seiNumber:     { type: String, unique: true, index: true },
  seiNumberNorm: { type: String, index: true },
  title:   String,
  subject: String,
  unit:    String,
  status:  String,
  tags:    [String],
  contracts: [String],
  createdAtSEI: Date,
  updatedAtSEI: Date,
  lastSyncedAt: Date
}, { timestamps: true });

ProcessSchema.index({ title: 'text', subject: 'text' });

module.exports = mongoose.model('Process', ProcessSchema);
