const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const platosSchema = new Schema({
    nombre: String,
    categoria: String,
    descripcion: String,
    precio: Number,
    stock: Number,
    stockMinimo: Number
});

const Platos = mongoose.model('Platos', platosSchema);
module.exports = Platos;
