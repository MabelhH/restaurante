const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const platosSchema = new Schema({
    nombre: {
        type: String,
        required: true
    },
    categoria: { 
        type: Schema.Types.ObjectId, 
        ref: 'Categoria', 
        required: true 
    },
    descripcion: String,
    precio: {
        type: Number,
        required: true
    },
    stock: {
        type: Number,
        required: true,
        default: 0
    },
    stockMinimo: {
        type: Number,
        required: true,
        default: 5
    },
    estado: {
        type: String,
        enum: ['activo', 'inactivo'],
        default: 'activo'
    },
    imagen: String,
    tiempoPreparacion: {
        type: Number,
        default: 15
    },
    // AGREGADO: Para control de disponibilidad
    disponible: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true // AGREGADO: Para created_at y updated_at automáticos
});

// AGREGADO: Método para verificar stock
platosSchema.methods.tieneStock = function(cantidad) {
  return this.stock >= cantidad;
};

// AGREGADO: Método para reducir stock
platosSchema.methods.reducirStock = function(cantidad) {
  this.stock -= cantidad;
  if (this.stock <= 0) {
    this.disponible = false;
  }
  return this.save();
};

const Platos = mongoose.model('Platos', platosSchema);
module.exports = Platos;