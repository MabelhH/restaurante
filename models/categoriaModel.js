const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const categoriaSchema = new Schema({
    nombre: {
        type: String,
        required: true,
        unique: true
    },
    descripcion: {
        type: String
    },
    estado: {
        type: String,
        enum: ['activo', 'inactivo'],
        default: 'activo'
    },
    // AGREGADO: Para ordenamiento en la carta
    orden: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

const Categoria = mongoose.model('Categoria', categoriaSchema);
module.exports = Categoria;