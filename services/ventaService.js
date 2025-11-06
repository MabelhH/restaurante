// services/ventaService.js
const Venta = require('../models/ventaModel');
const Platos = require('../models/platosModel');

class VentaService {
  async getAll() {
    return await Venta.find()
      .populate('mesa', 'numeroMesa piso sector')
      .populate('pedido')
      .populate('mesero', 'nombre email')
      .populate('platos.plato', 'nombre precio imagen');
  }

  async getById(id) {
    return await Venta.findById(id)
      .populate('mesa', 'numeroMesa piso sector')
      .populate('pedido')
      .populate('mesero', 'nombre email')
      .populate('platos.plato', 'nombre precio imagen');
  }

  async create(data) {
    if (!data.platos || data.platos.length === 0) {
      throw new Error('Debe incluir al menos un plato en la venta');
    }

    let total = 0;

    for (let item of data.platos) {
      const prod = await Platos.findById(item.plato);
      if (!prod) throw new Error(`Producto no encontrado: ${item.plato}`);
      if (prod.stock < item.cantidad) throw new Error(`Stock insuficiente para ${prod.nombre}`);

      item.precioUnitario = prod.precio;
      total += item.cantidad * prod.precio;

      // Actualizar stock
      prod.stock -= item.cantidad;
      await prod.save();
    }

    const venta = new Venta({
      ...data,
      total
    });

    return await venta.save();
  }

  async delete(id) {
    return await Venta.findByIdAndDelete(id);
  }

  // ✅ Nuevo método para estadísticas
  async obtenerEstadisticas(fechaInicio, fechaFin) {
    const matchStage = {};
    if (fechaInicio && fechaFin) {
      matchStage.fechaVenta = {
        $gte: new Date(fechaInicio),
        $lte: new Date(fechaFin)
      };
    }

    const estadisticas = await Venta.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: null,
          totalVentas: { $sum: '$total' },
          totalVentasCount: { $sum: 1 },
          promedioVenta: { $avg: '$total' }
        }
      }
    ]);

    return estadisticas[0] || {};
  }

  // Nuevo método para obtener ventas por rango de fechas
  async obtenerVentasPorFecha(fechaInicio, fechaFin) {
    return await Venta.find({
      fechaVenta: {
        $gte: new Date(fechaInicio),
        $lte: new Date(fechaFin)
      }
    })
    .populate('mesa', 'numeroMesa')
    .populate('mesero', 'nombre')
    .populate('platos.plato', 'nombre precio')
    .sort({ fechaVenta: -1 });
  }
}

module.exports = VentaService;