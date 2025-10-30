const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const pedidoSchema = new Schema({
  mesa: { 
    type: Schema.Types.ObjectId, 
    ref: 'Mesa', // referencia al modelo Mesa
    required: true 
  },
  platos: [
    {
      producto: { type: Schema.Types.ObjectId, ref: 'Platos', required: true },
      nombre: { type: String, required: true },
      precio: { type: Number, required: true },
      cantidad: { type: Number, required: true },
      adicionales: { type: String }
    }
  ],
  total: { type: Number, required: true },
  estado: {
    type: String,
    enum: ['pendiente', 'enviado', 'entregado'],
    default: 'pendiente',
    required: true
  },
  fechaPedido: { 
    type: Date, 
    default: Date.now 
  }
});

const Pedido = mongoose.model('Pedido', pedidoSchema);
module.exports = Pedido;