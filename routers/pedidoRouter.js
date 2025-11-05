const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Pedido = require('../models/pedidosModel');
const Mesa = require('../models/mesasModel');
const Pago = require('../models/pagoModel');

/* Agregar plato al pedido (carrito temporal en sesión) */
router.post('/agregar', (req, res) => {
  try {
    const { id, nombre, precio, cantidad } = req.body;
    if (!req.session.pedido) req.session.pedido = { platos: [] };

    const index = req.session.pedido.platos.findIndex(p => p.id === id);
    if (index >= 0) {
      req.session.pedido.platos[index].cantidad += Number(cantidad);
    } else {
      req.session.pedido.platos.push({
        id,
        nombre,
        precio: Number(precio),
        cantidad: Number(cantidad)
      });
    }

    console.log('🧾 Pedido actual:', req.session.pedido);
    res.json({ success: true, pedido: req.session.pedido });
  } catch (err) {
    console.error('❌ Error al agregar plato:', err);
    res.status(500).json({ success: false, message: 'Error al agregar plato' });
  }
});

/* Ver pedido actual + pedidos registrados */
router.get('/ver', async (req, res) => {
  try {
    const pedidoActual = req.session.pedido || { platos: [] };
    const pedidos = await Pedido.find()
      .populate('mesa', 'numeroMesa piso sector')
      .populate('platos.producto', 'nombre precio')
      .sort({ createdAt: -1 });

    res.render('pedidosMesero', { pedidoActual, pedidos });
  } catch (err) {
    console.error('❌ Error al cargar pedidos:', err);
    res.status(500).send('Error al cargar pedidos');
  }
});

/* Registrar pedido definitivo (resuelve mesa por número o por id) */
router.post('/registrar', async (req, res) => {
  try {
    const { mesa } = req.body; // puede ser número o ObjectId
    const pedidoSesion = req.session.pedido;

    if (!pedidoSesion || pedidoSesion.platos.length === 0) {
      return res.status(400).send('No hay platos en el pedido');
    }

    let mesaDoc = null;
    // 1) Si viene un ObjectId válido -> buscar por id
    if (typeof mesa === 'string' && /^[0-9a-fA-F]{24}$/.test(mesa.trim())) {
      mesaDoc = await Mesa.findById(mesa.trim());
    }

    // 2) Si no se encontró por id, intentar por numeroMesa (número entero)
    if (!mesaDoc) {
      const numero = Number(mesa);
      if (!Number.isNaN(numero)) {
        mesaDoc = await Mesa.findOne({ numeroMesa: numero });
      }
    }

    if (!mesaDoc) {
      return res.status(400).send('Mesa no encontrada. Asegúrate de usar un número de mesa válido.');
    }

    const total = pedidoSesion.platos.reduce((sum, p) => sum + p.precio * p.cantidad, 0);

    const nuevoPedido = new Pedido({
      mesa: mesaDoc._id,
      platos: pedidoSesion.platos.map(p => ({
        producto: p.id,
        nombre: p.nombre,
        precio: p.precio,
        cantidad: p.cantidad
      })),
      total,
      estado: 'pendiente'
    });

    await nuevoPedido.save();

    mesaDoc.estado = 'ocupada';
    await mesaDoc.save();

    const nuevoPago = new Pago({
      pedido: nuevoPedido._id,
      mesa: mesaDoc._id,
      montoTotal: total,
      estadoPago: 'pendiente'
    });
    await nuevoPago.save();

    req.session.pedido = { platos: [] }; // limpiar carrito
    console.log('✅ Pedido registrado correctamente:', nuevoPedido._id);
    res.redirect('/pedidos/ver');
  } catch (err) {
    console.error('❌ Error al registrar pedido:', err);
    res.status(500).send('Error al registrar pedido');
  }
});

/* Actualizar estado */
router.post('/actualizar-estado/:id', async (req, res) => {
  try {
    const pedidoId = req.params.id;
    const { estado } = req.body;
    const pedido = await Pedido.findById(pedidoId).populate('mesa');
    if (!pedido) return res.status(404).send('Pedido no encontrado');

    pedido.estado = estado;
    await pedido.save();

    if (estado === 'entregado') {
      const mesa = await Mesa.findById(pedido.mesa._id);
      if (mesa) {
        mesa.estado = 'liberada';
        await mesa.save();
      }
      const pago = await Pago.findOne({ pedido: pedido._id });
      if (pago) {
        pago.estadoPago = 'pagado';
        await pago.save();
      }
    }

    res.redirect('/pedidos/ver');
  } catch (err) {
    console.error('❌ Error al actualizar estado:', err);
    res.status(500).send('Error al actualizar estado');
  }
});

/* Limpiar pedido actual */
router.post('/limpiar', (req, res) => {
  req.session.pedido = { platos: [] };
  res.redirect('/pedidos/ver');
});

module.exports = router;
