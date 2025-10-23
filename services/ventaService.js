const Venta = require('../models/ventaModel');
const Producto = require('../models/platosModel');

class VentaService {
  async getAll() {
    return await Venta.find()
      .populate('cliente')
      .populate('platos.producto');
  }

  async getById(id) {
    return await Venta.findById(id)
      .populate('cliente')
      .populate('platos.producto');
  }

  async create(data) {
    if (!data.platos || data.platos.length === 0) {
      throw new Error('Debe incluir al menos un plato en la venta');
    }

    let total = 0;

    for (let item of data.platos) {
      const prod = await Producto.findById(item.producto);
      if (!prod) throw new Error(`Producto no encontrado: ${item.producto}`);
      if (prod.stock < item.cantidad) throw new Error(`Stock insuficiente para ${prod.nombre}`);

      item.precioUnitario = prod.precio;
      total += item.cantidad * prod.precio;

      // Actualizar stock
      prod.stock -= item.cantidad;
      await prod.save();
    }

    const venta = new Venta({
      cliente: data.cliente,
      platos: data.platos,
      total
    });

    return await venta.save();
  }

  async delete(id) {
    return await Venta.findByIdAndDelete(id);
  }
}

module.exports = VentaService;