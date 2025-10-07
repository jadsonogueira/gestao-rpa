// models/Measurement.js
const mongoose = require('mongoose');

const MeasurementSchema = new mongoose.Schema({
  contractNumber: { type: String, index: true },
  medicaoNumber:  { type: Number, index: true },
  periodStart: Date,
  periodEnd:   Date,
  status: String,
  totals: {
    bruto: Number,
    deducoes: Number,
    liquido: Number
  },
  processSei: String,      // amarração simples
  updatedAtSEI: Date,
  lastSyncedAt: Date
}, { timestamps: true });

MeasurementSchema.index({ contractNumber: 1, medicaoNumber: 1 }, { unique: true });

module.exports = mongoose.model('Measurement', MeasurementSchema);
