// controllers/ventasController.js
const Venta = require('../models/ventaModel');
const Pedido = require('../models/pedidosModel');

class VentaController {
  
  // Listar todas las ventas
  async listar(req, res) {
    try {
      const { fecha, mesero, metodoPago } = req.query;
      const filtro = {};

      if (fecha) {
        const startDate = new Date(fecha);
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 1);
        filtro.fechaVenta = { $gte: startDate, $lt: endDate };
      }

      if (mesero) filtro.mesero = mesero;
      if (metodoPago) filtro.metodoPago = metodoPago;

      const ventas = await Venta.find(filtro)
        .populate('mesa', 'numeroMesa piso sector')
        .populate('pedido')
        .populate('mesero', 'nombre email')
        .populate('platos.plato', 'nombre precio imagen')
        .sort({ fechaVenta: -1 });

      res.json(ventas);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  // Obtener venta por ID
  async obtener(req, res) {
    try {
      const venta = await Venta.findById(req.params.id)
        .populate('mesa', 'numeroMesa piso sector')
        .populate('pedido')
        .populate('mesero', 'nombre email')
        .populate('platos.plato', 'nombre precio imagen');

      if (!venta) {
        return res.status(404).json({ error: 'Venta no encontrada' });
      }

      res.json(venta);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  // Crear venta manualmente (para casos especiales)
  async crear(req, res) {
    try {
      const ventaData = req.body;
      
      // Calcular total si no se proporciona
      if (!ventaData.total) {
        ventaData.subtotal = ventaData.platos.reduce((sum, plato) => 
          sum + (plato.precio * plato.cantidad), 0);
        ventaData.total = ventaData.subtotal * 1.18; // con IGV
      }

      const nuevaVenta = new Venta(ventaData);
      await nuevaVenta.save();

      const ventaPopulada = await Venta.findById(nuevaVenta._id)
        .populate('mesa', 'numeroMesa')
        .populate('mesero', 'nombre');

      res.status(201).json(ventaPopulada);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  // Eliminar venta (solo admin)
  async eliminar(req, res) {
    try {
      const venta = await Venta.findByIdAndDelete(req.params.id);
      if (!venta) {
        return res.status(404).json({ error: 'Venta no encontrada' });
      }

      res.json({ mensaje: 'Venta eliminada correctamente' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  // Estadísticas de ventas
  async estadisticas(req, res) {
    try {
      const { fechaInicio, fechaFin } = req.query;
      
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
            promedioVenta: { $avg: '$total' },
            ventaMaxima: { $max: '$total' },
            ventaMinima: { $min: '$total' }
          }
        }
      ]);

      const ventasPorMetodo = await Venta.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: '$metodoPago',
            total: { $sum: '$total' },
            count: { $sum: 1 }
          }
        }
      ]);

      const ventasPorMesero = await Venta.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: '$mesero',
            total: { $sum: '$total' },
            count: { $sum: 1 }
          }
        },
        {
          $lookup: {
            from: 'users',
            localField: '_id',
            foreignField: '_id',
            as: 'meseroInfo'
          }
        }
      ]);

      res.json({
        general: estadisticas[0] || {},
        porMetodoPago: ventasPorMetodo,
        porMesero: ventasPorMesero
      });

    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  // Obtener ventas del día actual
  async ventasHoy(req, res) {
    try {
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);
      const manana = new Date(hoy);
      manana.setDate(manana.getDate() + 1);

      const ventasHoy = await Venta.find({
        fechaVenta: { $gte: hoy, $lt: manana }
      })
      .populate('mesa', 'numeroMesa')
      .populate('mesero', 'nombre')
      .populate('platos.plato', 'nombre precio')
      .sort({ fechaVenta: -1 });

      const totalHoy = ventasHoy.reduce((sum, venta) => sum + venta.total, 0);

      res.json({
        ventas: ventasHoy,
        total: totalHoy,
        cantidad: ventasHoy.length
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  // Nuevo método para obtener ventas por rango de fechas
  async ventasPorFecha(req, res) {
    try {
      const { fechaInicio, fechaFin } = req.query;

      if (!fechaInicio || !fechaFin) {
        return res.status(400).json({ error: 'fechaInicio y fechaFin son requeridos' });
      }

      const ventas = await Venta.find({
        fechaVenta: {
          $gte: new Date(fechaInicio),
          $lte: new Date(fechaFin)
        }
      })
      .populate('mesa', 'numeroMesa')
      .populate('mesero', 'nombre')
      .populate('platos.plato', 'nombre precio')
      .sort({ fechaVenta: -1 });

      const total = ventas.reduce((sum, venta) => sum + venta.total, 0);

      res.json({
        ventas,
        total,
        cantidad: ventas.length
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = new VentaController();