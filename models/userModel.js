// models/userModel.js
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

// Hook para encriptar la contraseña automáticamente antes de guardar
usuarioSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next(); // Solo encriptar si cambió
  try {
    this.password = await bcrypt.hash(this.password, 10);
    next();
  } catch (err) {
    next(err);
  }
});

// Método para comparar contraseña en login
usuarioSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

const Usuario = mongoose.model('Usuario', usuarioSchema);
module.exports = Usuario;