const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const bcrypt = require('bcrypt');


const usuarioSchema = new Schema({
    nombre: { type: String, required: true },
    apellido: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    rol: {
        type: String,
        enum: ['admin', 'cocinero', 'mesero', 'cajero'],
        default: 'mesero',
        required: true
    }
});

const Usuario = mongoose.model('Usuario', usuarioSchema);
module.exports = Usuario;