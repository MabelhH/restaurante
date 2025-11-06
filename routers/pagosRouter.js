const express = require('express');
const router = express.Router();
const Pedido = require('../models/pedidosModel');
const Mesa = require('../models/mesasModel');
const Venta = require('../models/ventaModel');
const mongoose = require('mongoose');

// Mostrar pedidos pendientes de pago
router.get('/', async (req, res) => {
  try {
    const pedidos = await Pedido.find({ 
      estadoPago: { $in: ['pendiente', 'parcial'] },
      activo: true 
    })
    .populate('mesa', 'numeroMesa piso sector')
    .populate('mesero', 'nombre')
    .populate('platos.plato', 'nombre precio imagen')
    .sort({ fechaPedido: 1 });

    res.json({
      success: true,
      pedidos: pedidos
    });
  } catch (error) {
    console.error('Error al obtener pedidos pendientes:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Registrar pago completo
router.post('/pagar/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { metodoPago, montoPagado, observaciones } = req.body;

    const pedido = await Pedido.findById(id);
    if (!pedido) {
      return res.status(404).json({ error: 'Pedido no encontrado' });
    }

    if (pedido.estadoPago === 'pagado') {
      return res.status(400).json({ error: 'El pedido ya está pagado' });
    }

    // Registrar pago
    pedido.estadoPago = 'pagado';
    pedido.fechaPago = new Date();
    pedido.historialPagos.push({
      monto: montoPagado || pedido.total,
      fecha: new Date(),
      metodo: metodoPago || 'efectivo',
      observaciones: observaciones || ''
    });

    await pedido.save();

    // Liberar mesa
    const mesa = await Mesa.findById(pedido.mesa);
    if (mesa) {
      mesa.estado = 'liberada';
      mesa.pedidoActual = null;
      await mesa.save();
    }

    // Crear registro de venta
    const venta = new Venta({
      mesa: pedido.mesa,
      pedido: pedido._id,
      platos: pedido.platos,
      subtotal: pedido.total,
      total: pedido.total * 1.18, // con IGV
      metodoPago: metodoPago || 'efectivo',
      mesero: pedido.mesero,
      observaciones: observaciones || ''
    });
    await venta.save();

    const pedidoActualizado = await Pedido.findById(id)
      .populate('mesa', 'numeroMesa piso sector')
      .populate('mesero', 'nombre')
      .populate('platos.plato', 'nombre precio imagen');

    res.json({
      success: true,
      message: 'Pago registrado exitosamente',
      pedido: pedidoActualizado,
      venta: venta
    });

  } catch (error) {
    console.error('Error al registrar pago:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Pago parcial
router.post('/pago-parcial/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { monto, metodoPago, observaciones } = req.body;

    const pedido = await Pedido.findById(id);
    if (!pedido) {
      return res.status(404).json({ error: 'Pedido no encontrado' });
    }

    // Registrar pago parcial
    pedido.estadoPago = 'parcial';
    pedido.historialPagos.push({
      monto: monto,
      fecha: new Date(),
      metodo: metodoPago || 'efectivo',
      observaciones: observaciones || ''
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
      success: true,
      message: 'Pago parcial registrado exitosamente',
      pedido: pedido,
      totalPagado: totalPagado,
      pendiente: pedido.total - totalPagado
    });

  } catch (error) {
    console.error('Error al registrar pago parcial:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Cancelar pedido
router.post('/cancelar/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { motivo } = req.body;

    const pedido = await Pedido.findById(id);
    if (!pedido) {
      return res.status(404).json({ error: 'Pedido no encontrado' });
    }

    // Devolver stock de los platos
    const Platos = require('../models/platosModel');
    for (const item of pedido.platos) {
      const plato = await Platos.findById(item.plato);
      if (plato) {
        plato.stock += item.cantidad;
        if (plato.stock > 0) {
          plato.disponible = true;
        }
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
    pedido.observacionesGenerales += `\nCancelado: ${motivo || 'Sin motivo especificado'}`;
    
    await pedido.save();

    res.json({
      success: true,
      message: 'Pedido cancelado exitosamente',
      pedido: pedido
    });

  } catch (error) {
    console.error('Error al cancelar pedido:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Obtener historial de pagos
router.get('/historial/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const pedido = await Pedido.findById(id)
      .select('historialPagos total estadoPago platos');

    if (!pedido) {
      return res.status(404).json({ error: 'Pedido no encontrado' });
    }

    const totalPagado = pedido.historialPagos.reduce((sum, pago) => sum + pago.monto, 0);
    const pendiente = pedido.total - totalPagado;

    res.json({
      success: true,
      historial: pedido.historialPagos,
      total: pedido.total,
      totalPagado: totalPagado,
      pendiente: pendiente,
      estadoPago: pedido.estadoPago
    });

  } catch (error) {
    console.error('Error al obtener historial de pagos:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;