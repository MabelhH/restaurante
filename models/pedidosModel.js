const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const pedidoSchema = new Schema({
  mesa: { 
    type: Schema.Types.ObjectId, 
    ref: 'Mesa', 
    required: true 
  },
  platos: [
    {
      plato: { 
        type: Schema.Types.ObjectId, 
        ref: 'Platos', 
        required: true 
      },
      nombre: { 
        type: String, 
        required: true 
      },
      precio: { 
        type: Number, 
        required: true 
      },
      cantidad: { 
        type: Number, 
        required: true,
        min: 1,
        default: 1
      },
      observaciones: { 
        type: String,
        default: ''
      },
      subtotal: {
        type: Number,
        required: true
      },
      // AGREGADO: Estado individual del plato
      estado: {
        type: String,
        enum: ['pendiente', 'en preparacion', 'listo', 'entregado', 'cancelado'],
        default: 'pendiente'
      }
    }
  ],
  total: { 
    type: Number, 
    required: true 
  },
  estadoPedido: {
    type: String,
    enum: ['pendiente', 'en preparacion', 'listo', 'entregado', 'cancelado'],
    default: 'pendiente',
    required: true
  },
  estadoPago: {
    type: String,
    enum: ['pendiente', 'pagado', 'parcial'],
    default: 'pendiente',
    required: true
  },
  mesero: {
    type: Schema.Types.ObjectId,
    ref: 'Usuario', // CAMBIADO: De 'User' a 'Usuario'
    required: true
  },
  fechaPedido: { 
    type: Date, 
    default: Date.now 
  },
  fechaPago: {
    type: Date
  },
  historialPagos: [
    {
      monto: Number,
      fecha: { type: Date, default: Date.now },
      metodo: String
    }
  ],
  // AGREGADO: Observaciones generales del pedido
  observacionesGenerales: {
    type: String,
    default: ''
  },
  activo: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true // AGREGADO: Para created_at y updated_at automáticos
});

// Middleware para calcular subtotales y total antes de guardar
pedidoSchema.pre('save', function(next) {
  // Calcular subtotal para cada plato
  this.platos.forEach(plato => {
    plato.subtotal = plato.precio * plato.cantidad;
  });
  
  // Calcular total general
  this.total = this.platos.reduce((sum, plato) => sum + plato.subtotal, 0);
  
  next();
});

// AGREGADO: Método para agregar platos adicionales
pedidoSchema.methods.agregarPlato = function(platoData) {
  this.platos.push(platoData);
  return this.save();
};

// AGREGADO: Método para actualizar estado del pedido
pedidoSchema.methods.actualizarEstado = function(nuevoEstado) {
  this.estadoPedido = nuevoEstado;
  return this.save();
};

const Pedido = mongoose.model('Pedido', pedidoSchema);
module.exports = Pedido;