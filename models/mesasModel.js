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
    enum: ['disponible', 'ocupada', 'atendida', 'liberada', 'reparacion','reserva'],
    default: 'disponible',
    required: true
  },
  capacidad: {
        type: Number,
        required: true,
        min: 1
  },
  piso: {
    type: String,
    enum: ['piso 1', 'piso 2', 'piso 3'],
    required: true
  },
  sector: {
    type: String,
    enum: ['vid', 'valcon', 'normal'],
    required: true
  },
  capacidad: {
    type: Number,
    required: true,
    default: 4
  },
  pedidoActual: {
    type: Schema.Types.ObjectId,
    ref: 'Pedido'
  },
  historialPedidos: [{
    pedido: { type: Schema.Types.ObjectId, ref: 'Pedido' },
    fecha: { type: Date, default: Date.now }
  }],
  qrCode: {
    type: String
  }
}, {
  timestamps: true // AGREGADO: Para created_at y updated_at automáticos
});

// AGREGADO: Método para liberar mesa
mesasSchema.methods.liberarMesa = function() {
  this.estado = 'liberada';
  this.pedidoActual = null;
  return this.save();
};

// AGREGADO: Método para marcar como atendida
mesasSchema.methods.marcarAtendida = function() {
  this.estado = 'atendida';
  return this.save();
};

const Mesa = mongoose.model('Mesa', mesasSchema);
module.exports = Mesa;