const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const reservaSchema = new Schema({
  mesas: [{
    type: Schema.Types.ObjectId,
    ref: 'Mesa', 
    required: true
  }],
  cliente: {
    type: Schema.Types.ObjectId,
    ref: 'Cliente', 
    required: true
  },
  fechaRegistro: { 
    type: Date,
    default: Date.now,
    required: true
  },
  diaReserva: { 
    type: Date,
    required: true
  },
  horaReserva: { 
    type: String,  
    required: true
  },
  numeroPersonas: { 
    type: Number,
    min: 1,
    default: 1
  },
  estadoReserva: {
    type: String,
    enum: ['pendiente', 'confirmada', 'cancelada', 'finalizada'],
    default: 'pendiente'
  },
  observaciones: {
    type: String,
    default: ''
  },
  activo: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});
const Reserva = mongoose.model('Reserva', reservaSchema);
module.exports = Reserva;
