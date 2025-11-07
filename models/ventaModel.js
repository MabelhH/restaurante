// models/Venta.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ventaSchema = new Schema({
  mesa: { 
    type: Schema.Types.ObjectId, 
    ref: 'Mesa', 
    required: true 
  },
  pedido: { 
    type: Schema.Types.ObjectId, 
    ref: 'Pedido', 
    required: true 
  },
  platos: [{
    plato: { type: Schema.Types.ObjectId, ref: 'Platos', required: true },
    nombre: { type: String, required: true },
    precio: { type: Number, required: true },
    cantidad: { type: Number, required: true },
    observaciones: { type: String },
    subtotal: { type: Number, required: true }
  }],
  subtotal: { 
    type: Number, 
    required: true 
  },
  igv: {
    type: Number,
    required: true,
    default: 0.18
  },
  total: { 
    type: Number, 
    required: true 
  },
  estado: {
    type: String,
    enum: ['completada', 'cancelada', 'reembolsada'],
    default: 'completada',
    required: true
  },
  metodoPago: {
    type: String,
    enum: ['efectivo', 'tarjeta', 'yape', 'plin'],
    required: true
  },
  mesero: {
    type: Schema.Types.ObjectId,
    ref: 'Usuario',
    required: true
  },
  fechaVenta: { 
    type: Date, 
    default: Date.now 
  },
  horaVenta: {
    type: String
  },
  cliente: {
    nombre: String,
    dni: String,
    ruc: String
  }
});

// Middleware para calcular total antes de guardar
ventaSchema.pre('save', function(next) {
  this.igv = this.subtotal * 0.18;
  this.total = this.subtotal + this.igv;
  this.horaVenta = new Date().toLocaleTimeString();
  next();
});

const Venta = mongoose.model('Venta', ventaSchema);
module.exports = Venta;