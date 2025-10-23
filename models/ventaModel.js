const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ventaSchema = new Schema({
    cliente: { type: Schema.Types.ObjectId, ref: 'Cliente', required: true },
    productos: [{
        producto: { type: Schema.Types.ObjectId, ref: 'Producto', required: true },
        cantidad: { type: Number, required: true },
        precioUnitario: { type: Number, required: true }
    }],
    total: { type: Number, required: true },
    fechaVenta: { type: Date, default: Date.now }
});

const Venta = mongoose.model('Venta', ventaSchema); // <-- mayúscula inicial
module.exports = Venta;
