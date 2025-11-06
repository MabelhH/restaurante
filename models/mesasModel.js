// models/mesasModel.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const mesasSchema = new Schema({
  numeroMesa: {
    type: Number,
    required: true,
    unique: true
  },
  estado: {
    type: String,
    enum: ['liberada', 'ocupada', 'reparacion'],
    default: 'liberada',
    required: true
  },
  piso: {
    type: String,
    enum: ['piso 1', 'piso 2', 'piso 3'],
    required: true
  },
  sector: {
    type: String,
    enum: ['vip', 'balcon', 'normal'],
    required: true
  }
});

const Mesa = mongoose.model('Mesa', mesasSchema);
module.exports = Mesa;