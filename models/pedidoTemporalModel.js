const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const pedidoTemporalSchema = new Schema({
  meseroId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  platos: [
    {
      plato: { type: Schema.Types.ObjectId, ref: 'Platos', required: true },
      cantidad: { type: Number, default: 1 },
    }
  ]
});

const PedidoTemporal = mongoose.model('PedidoTemporal', pedidoTemporalSchema);
module.exports = PedidoTemporal;
