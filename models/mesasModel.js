const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const mesaSchema = new Schema({
  numeroMesa: { 
    type: Number, 
    required: true, 
    unique: true 
  },
  estado: { 
    type: String, 
    enum: ['atendida', 'liberada','ocupada'], 
    default: 'liberada', 
    required: true 
  },
  piso: { 
    type: String, 
    enum: ['piso 1', 'piso 2', 'piso 3'], 
    required: true 
  },
  sector: {
      type:String,
      enun: ['vid', 'valcon', 'normal'],
      required:true
  }
});

// Middleware para asignar número de mesa autoincremental

const Mesa = mongoose.model('Mesa', mesaSchema);
module.exports = Mesa;