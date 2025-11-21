// controllers/pagosController.js
const Pedido = require('../models/pedidosModel');
const Venta = require('../models/ventaModel');
const Mesa = require('../models/mesasModel');

class PagosController {

  // ✅ Mostrar pedidos pendientes de pago
  async verPagos(req, res) {
    try {
      const pedidos = await Pedido.find({ 
        estadoPago: 'pendiente',
        activo: true 
      })
      .populate('mesa', 'numeroMesa piso sector')
      .populate('mesero', 'nombre')
      .populate('platos.plato', 'nombre precio imagen')
      .sort({ fechaPedido: 1 });

      // Para vista renderizada
      if (req.accepts('html')) {
        return res.render('pagos', { pedidos });
      }

      // Para API
      res.json(pedidos);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Error al cargar los pedidos pendientes' });
    }
  }

  // ✅ Registrar pago completo
  async pagarPedido(req, res) {
    try {
      const { id } = req.params;
      const { metodoPago, montoRecibido, vuelto } = req.body;

      const pedido = await Pedido.findById(id);
      if (!pedido) {
        return res.status(404).json({ error: 'Pedido no encontrado' });
      }

      if (pedido.estadoPago === 'pagado') {
        return res.status(400).json({ error: 'El pedido ya está pagado' });
      }

      // Marcar pedido como pagado
      pedido.estadoPago = 'pagado';
      pedido.fechaPago = new Date();
      pedido.historialPagos.push({
        monto: pedido.total,
        fecha: new Date(),
        metodo: metodoPago || 'efectivo'
      });
      await pedido.save();

      // Crear registro de venta
      const venta = new Venta({
        mesa: pedido.mesa,
        pedido: pedido._id,
        platos: pedido.platos,
        subtotal: pedido.total,
        total: pedido, // con IGV
        metodoPago: metodoPago || 'efectivo',
        mesero: pedido.mesero,
        cliente: {
          // Puedes agregar datos del cliente aquí si los tienes
        }
      });
      await venta.save();

      // ✅ Liberar mesa
      const mesa = await Mesa.findById(pedido.mesa);
      if (mesa) {
        mesa.estado = 'liberada';
        mesa.pedidoActual = null;
        await mesa.save();
      }

      const pedidoActualizado = await Pedido.findById(id)
        .populate('mesa', 'numeroMesa')
        .populate('mesero', 'nombre')
        .populate('platos.plato', 'nombre precio');

      // Para vista renderizada
      if (req.accepts('html')) {
        return res.redirect('/pagos');
      }

      // Para API
      res.json({
        mensaje: 'Pago registrado exitosamente',
        pedido: pedidoActualizado,
        venta: venta,
        vuelto: vuelto || 0
      });

    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Error al registrar el pago' });
    }
  }

  // ✅ Pago parcial
  async pagoParcial(req, res) {
    try {
      const { id } = req.params;
      const { monto, metodoPago } = req.body;

      const pedido = await Pedido.findById(id);
      if (!pedido) {
        return res.status(404).json({ error: 'Pedido no encontrado' });
      }

      // Registrar pago parcial
      pedido.estadoPago = 'parcial';
      pedido.historialPagos.push({
        monto: monto,
        fecha: new Date(),
        metodo: metodoPago
      });

      // Verificar si el total ya está cubierto
      const totalPagado = pedido.historialPagos.reduce((sum, pago) => sum + pago.monto, 0);
      if (totalPagado >= pedido.total) {
        pedido.estadoPago = 'pagado';
        pedido.fechaPago = new Date();

        // Liberar mesa si está completamente pagado
        const mesa = await Mesa.findById(pedido.mesa);
        if (mesa) {
          mesa.estado = 'liberada';
          mesa.pedidoActual = null;
          await mesa.save();
        }
      }

      await pedido.save();

      res.json({
        mensaje: 'Pago parcial registrado',
        pedido: pedido,
        totalPagado: totalPagado,
        pendiente: pedido.total - totalPagado
      });

    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  // ✅ Cancelar pedido
  async cancelarPedido(req, res) {
    try {
      const { id } = req.params;
      const { motivo } = req.body;

      const pedido = await Pedido.findById(id);
      if (!pedido) {
        return res.status(404).json({ error: 'Pedido no encontrado' });
      }

      // Devolver stock de los platos
      const Platos = require('../models/Platos');
      for (const item of pedido.platos) {
        const plato = await Platos.findById(item.plato);
        if (plato) {
          plato.stock += item.cantidad;
          await plato.save();
        }
      }

      // Liberar mesa
      const mesa = await Mesa.findById(pedido.mesa);
      if (mesa) {
        mesa.estado = 'disponible';
        mesa.pedidoActual = null;
        await mesa.save();
      }

      // Marcar pedido como cancelado
      pedido.estadoPedido = 'cancelado';
      pedido.estadoPago = 'cancelado';
      pedido.activo = false;
      await pedido.save();

      // Para vista renderizada
      if (req.accepts('html')) {
        return res.redirect('/pagos');
      }

      // Para API
      res.json({
        mensaje: 'Pedido cancelado exitosamente',
        motivo: motivo || 'Sin motivo especificado'
      });

    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Error al cancelar el pedido' });
    }
  }

  // ✅ Obtener historial de pagos de un pedido
  async historialPagos(req, res) {
    try {
      const { id } = req.params;
      
      const pedido = await Pedido.findById(id)
        .select('historialPagos total estadoPago');
      
      if (!pedido) {
        return res.status(404).json({ error: 'Pedido no encontrado' });
      }

      const totalPagado = pedido.historialPagos.reduce((sum, pago) => sum + pago.monto, 0);
      const pendiente = pedido.total - totalPagado;

      res.json({
        historial: pedido.historialPagos,
        total: pedido.total,
        totalPagado: totalPagado,
        pendiente: pendiente,
        estadoPago: pedido.estadoPago
      });

    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = new PagosController();