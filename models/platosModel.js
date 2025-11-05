const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const platosSchema = new Schema({
    nombre: String,
    categoria: { type: Schema.Types.ObjectId, ref: 'Categoria', required: true },
    descripcion: String,
    precio: Number,
    stock: Number,
    stockMinimo: Number,
    estado: {
        type: String,
        enum: ['activo', 'inactivo'],
        default: 'activo'
    },
    imagen: String
});

const Platos = mongoose.model('Platos', platosSchema);
module.exports = Platos;
