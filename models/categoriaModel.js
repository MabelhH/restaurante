// models/categoriaModel.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const categoriaSchema = new Schema({
  nombre: { type: String, required: true, unique: true } // Solo guardamos el nombre
});

const Categoria = mongoose.model('Categoria', categoriaSchema);
module.exports = Categoria;