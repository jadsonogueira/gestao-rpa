// models/Usuario.js
const mongoose = require('mongoose');

const usuarioSchema = new mongoose.Schema({
  nome: {
    type: String,
    required: true
  }
});

module.exports = mongoose.model('Usuario', usuarioSchema);
