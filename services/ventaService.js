const Venta = require('../models/ventaModel');
const Producto = require('../models/platosModel');
const Cliente = require('../models/clienteModel');

class VentaService {
  // Listar ventas con cliente y productos populados
  async getAll() {
    return await Venta.find()
      .populate('cliente') // ahora cliente es referencia
      .populate('productos.producto');
  }

  async getById(id) {
    return await Venta.findById(id)
      .populate('cliente')
      .populate('productos.producto');
  }

  async create(data) {
    // Obtener productos completos para calcular total
    let total = 0;

    for (let item of data.productos) {
      const prod = await Producto.findById(item.producto);
      if (!prod) throw new Error('Producto no encontrado');
      if (prod.stock < item.cantidad) throw new Error(`Stock insuficiente para ${prod.nombre}`);
      
      item.precioUnitario = prod.precio;
      total += item.cantidad * prod.precio;

      // Restar stock
      prod.stock -= item.cantidad;
      await prod.save();
    }

    const venta = new Venta({
      cliente: data.cliente,
      productos: data.productos,
      total
    });

    return await venta.save();
  }

  async delete(id) {
    return await Venta.findByIdAndDelete(id);
  }
}

module.exports = VentaService;
