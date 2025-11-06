const express = require('express');
const router = express.Router();
const Pedido = require('../models/pedidosModel');
const Usuario = require('../models/userModel');
const Mesa = require('../models/mesasModel');
const Platos = require('../models/platosModel');
const mongoose = require('mongoose');

// Ruta para crear pedidos - RF010: Registro de pedidos por cliente o mesa
router.post('/', async (req, res) => {
  try {
    const { mesaId, platos, meseroId, observacionesGenerales } = req.body;

    console.log('Datos recibidos para nuevo pedido:', req.body);

    // Validaciones básicas
    if (!mesaId || !mongoose.Types.ObjectId.isValid(mesaId)) {
      return res.status(400).json({ 
        error: 'ID de mesa inválido o vacío' 
      });
    }

    if (!meseroId || !mongoose.Types.ObjectId.isValid(meseroId)) {
      return res.status(400).json({ 
        error: 'ID de mesero inválido o vacío' 
      });
    }

    if (!platos || platos.length === 0) {
      return res.status(400).json({ 
        error: 'El pedido debe contener al menos un plato' 
      });
    }

    // Validar que el mesero existe
    const mesero = await Usuario.findById(meseroId);
    if (!mesero) {
      return res.status(404).json({ 
        error: 'Mesero no encontrado' 
      });
    }

    // Validar que la mesa existe y está disponible
    const mesa = await Mesa.findById(mesaId);
    if (!mesa) {
      return res.status(404).json({ 
        error: 'Mesa no encontrada' 
      });
    }

    if (mesa.estado !== 'disponible' && mesa.estado !== 'liberada') {
      return res.status(400).json({ 
        error: 'La mesa no está disponible' 
      });
    }

    // Validar stock y precios de los platos
    const platosConDetalles = [];
    for (const item of platos) {
      const plato = await Platos.findById(item.platoId);
      if (!plato) {
        return res.status(404).json({ 
          error: `Plato no encontrado: ${item.platoId}` 
        });
      }

      if (!plato.tieneStock(item.cantidad)) {
        return res.status(400).json({ 
          error: `Stock insuficiente para: ${plato.nombre}` 
        });
      }

      platosConDetalles.push({
        plato: item.platoId,
        nombre: plato.nombre,
        precio: plato.precio,
        cantidad: item.cantidad,
        observaciones: item.observaciones || '',
        subtotal: plato.precio * item.cantidad,
        estado: 'pendiente'
      });
    }

    // Calcular total
    const total = platosConDetalles.reduce((sum, plato) => sum + plato.subtotal, 0);

    // Crear el pedido
    const pedido = new Pedido({
      mesa: mesaId,
      platos: platosConDetalles,
      mesero: meseroId,
      observacionesGenerales: observacionesGenerales || '',
      total: total,
      estadoPedido: 'pendiente',
      estadoPago: 'pendiente'
    });

    const pedidoGuardado = await pedido.save();

    // Actualizar stock de platos
    for (const item of platos) {
      await Platos.findByIdAndUpdate(
        item.platoId, 
        { $inc: { stock: -item.cantidad } }
      );
    }

    // Actualizar estado de la mesa
    mesa.estado = 'ocupada';
    mesa.pedidoActual = pedidoGuardado._id;
    mesa.historialPedidos.push({ 
      pedido: pedidoGuardado._id, 
      fecha: new Date() 
    });
    await mesa.save();

    console.log('Pedido creado exitosamente:', pedidoGuardado._id);
    
    res.status(201).json({
      success: true,
      message: 'Pedido registrado con éxito',
      pedido: pedidoGuardado
    });

  } catch (error) {
    console.error('Error al crear pedido:', error);
    
    if (error.name === 'ValidationError') {
      return res.status(400).json({ 
        error: 'Datos de pedido inválidos: ' + error.message 
      });
    }
    
    res.status(500).json({ 
      error: 'Error interno del servidor: ' + error.message 
    });
  }
});

// RF012: Adición de nuevos pedidos a mesas existentes
router.post('/:pedidoId/agregar-platos', async (req, res) => {
  try {
    const { pedidoId } = req.params;
    const { platos } = req.body;

    const pedido = await Pedido.findById(pedidoId);
    if (!pedido) {
      return res.status(404).json({ error: 'Pedido no encontrado' });
    }

    // Validar que el pedido no esté pagado
    if (pedido.estadoPago === 'pagado') {
      return res.status(400).json({ 
        error: 'No se pueden agregar platos a un pedido ya pagado' 
      });
    }

    // Agregar nuevos platos
    for (const item of platos) {
      const plato = await Platos.findById(item.platoId);
      if (!plato.tieneStock(item.cantidad)) {
        return res.status(400).json({ 
          error: `Stock insuficiente para: ${plato.nombre}` 
        });
      }

      await pedido.agregarPlato({
        plato: item.platoId,
        nombre: plato.nombre,
        precio: plato.precio,
        cantidad: item.cantidad,
        observaciones: item.observaciones || '',
        subtotal: plato.precio * item.cantidad,
        estado: 'pendiente'
      });

      // Actualizar stock
      await Platos.findByIdAndUpdate(
        item.platoId, 
        { $inc: { stock: -item.cantidad } }
      );
    }

    res.json({
      success: true,
      message: 'Platos agregados al pedido exitosamente',
      pedido: pedido
    });

  } catch (error) {
    console.error('Error al agregar platos:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// RF014: Consulta de estado de pedidos
router.get('/mesa/:mesaId', async (req, res) => {
  try {
    const { mesaId } = req.params;

    const pedidos = await Pedido.find({ 
      mesa: mesaId,
      activo: true 
    })
    .populate('mesero', 'nombre apellido')
    .populate('platos.plato', 'nombre tiempoPreparacion')
    .sort({ fechaPedido: -1 });

    res.json({
      success: true,
      pedidos: pedidos
    });

  } catch (error) {
    console.error('Error al obtener pedidos:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// RF013: Finalización de atención por mesa
router.put('/mesa/:mesaId/liberar', async (req, res) => {
  try {
    const { mesaId } = req.params;

    const mesa = await Mesa.findById(mesaId);
    if (!mesa) {
      return res.status(404).json({ error: 'Mesa no encontrada' });
    }

    await mesa.liberarMesa();

    res.json({
      success: true,
      message: 'Mesa liberada exitosamente',
      mesa: mesa
    });

  } catch (error) {
    console.error('Error al liberar mesa:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;