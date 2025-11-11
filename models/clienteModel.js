const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const clienteSchema = new Schema({
    nombre: String,
    apellido: String,
    telefono: String,
    activo: {  // ← AGREGAR ESTE CAMPO
        type: Boolean,
        default: true
    }
});

const Cliente = mongoose.model('Cliente', clienteSchema);
module.exports = Cliente;
