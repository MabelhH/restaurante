const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const pagoSchema = new Schema({
  pedido: {
    type: Schema.Types.ObjectId,
    ref: 'Pedido',
    required: true
  },
  mesa: {
    type: Schema.Types.ObjectId,
    ref: 'Mesa',
    required: true
  },
  montoTotal: {
    type: Number,
    required: true
  },
  metodoPago: {
    type: String,
    enum: ['efectivo', 'tarjeta', 'yape', 'plin', 'pendiente'],
    default: 'pendiente'
  },
  estadoPago: {
    type: String,
    enum: ['pendiente', 'pagado', 'anulado'],
    default: 'pendiente'
  },
  fechaPago: {
    type: Date,
    default: Date.now
  },
  observacion: {
    type: String
  }
});

const Pago = mongoose.model('Pago', pagoSchema);
module.exports = Pago;
