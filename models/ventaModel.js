const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ventaSchema = new Schema({
    cliente: { type: Schema.Types.ObjectId, ref: 'Cliente', required: true },
    platos: [{
        producto: { type: Schema.Types.ObjectId, ref: 'Platos', required: true },
        cantidad: { type: Number, required: true },
        precioUnitario: { type: Number, required: true }
    }],
    total: { type: Number, required: true },
    fechaVenta: { type: Date, default: Date.now } // ✅ fecha de venta automática
});

const Venta = mongoose.model('Venta', ventaSchema);
module.exports = Venta;