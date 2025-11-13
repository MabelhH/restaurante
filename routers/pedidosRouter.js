const express = require('express');
const router = express.Router();
const Pedido = require('../models/pedidosModel');
const Usuario = require('../models/userModel');
const Mesa = require('../models/mesasModel');
const Platos = require('../models/platosModel');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

const SECRET_KEY = 'tu_clave_secreta_aqui';

// Middleware para verificar token
function verifyToken(req, res, next) {
    const token = req.cookies.token;
    if (!token) {
        return res.status(401).json({ error: 'Token no proporcionado' });
    }

    try {
        const decoded = jwt.verify(token, SECRET_KEY);
        req.user = decoded;
        next();
    } catch (err) {
        res.clearCookie('token');
        return res.status(401).json({ error: 'Token inválido' });
    }
}

// Ruta para crear pedidos - RF010: Registro de pedidos por cliente o mesa
router.post('/', verifyToken, async (req, res) => {
  try {
    const { mesaId, platos, observacionesGenerales } = req.body;

    console.log('📦 Datos recibidos para nuevo pedido:', req.body);
    console.log('👤 Usuario autenticado:', req.user);

    // Validaciones básicas
    if (!mesaId || !mongoose.Types.ObjectId.isValid(mesaId)) {
      return res.status(400).json({ 
        error: 'ID de mesa inválido o vacío' 
      });
    }

    // USAR el _id del usuario autenticado en lugar de recibirlo en el body
    const meseroId = req.user._id;

    if (!meseroId) {
      return res.status(400).json({ 
        error: 'No se pudo identificar al mesero desde el token' 
      });
    }

    if (!platos || platos.length === 0) {
      return res.status(400).json({ 
        error: 'El pedido debe contener al menos un plato' 
      });
    }

    // Buscar mesero por ID del token
    const mesero = await Usuario.findById(meseroId);
    if (!mesero) {
      return res.status(404).json({ 
        error: 'Mesero no encontrado en la base de datos' 
      });
    }

    // Validar que la mesa existe y está disponible
    const mesa = await Mesa.findById(mesaId);
    if (!mesa) {
      return res.status(404).json({ 
        error: 'Mesa no encontrada' 
      });
    }

    if (mesa.estado !== 'disponible' && mesa.estado !== 'liberada'  && mesa.estado !== 'ocupada') {
      return res.status(400).json({ 
        error: 'La mesa no está disponible. Estado actual: ' + mesa.estado 
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

      // CORREGIDO: Usar el método tieneStock del modelo
      if (!plato.tieneStock(item.cantidad)) {
        return res.status(400).json({ 
          error: `Stock insuficiente para: ${plato.nombre}. Stock disponible: ${plato.stock}` 
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

    // Generar número de pedido único (formato: 0001, 0002, etc.)
    const fechaHoy = new Date();
    fechaHoy.setHours(0, 0, 0, 0);
    const fechaManana = new Date(fechaHoy);
    fechaManana.setDate(fechaManana.getDate() + 1);

    const pedidosHoy = await Pedido.countDocuments({
      fechaPedido: { $gte: fechaHoy, $lt: fechaManana }
    });

    const numeroPedido = String(pedidosHoy + 1).padStart(4, '0');

    // Crear el pedido - CORREGIDO: Usar _id del mesero del token
    const pedido = new Pedido({
      mesa: mesaId,
      platos: platosConDetalles,
      mesero: mesero._id,
      observacionesGenerales: observacionesGenerales || '',
      total: total,
      estadoPedido: 'pendiente',
      estadoPago: 'pendiente',
      numeroPedido: numeroPedido
    });

    const pedidoGuardado = await pedido.save();

    // Actualizar stock de platos - CORREGIDO: Usar el método reducirStock
    for (const item of platos) {
      const plato = await Platos.findById(item.platoId);
      if (plato) {
        await plato.reducirStock(item.cantidad);
      }
    }

    // Actualizar estado de la mesa
    mesa.estado = 'ocupada';
    mesa.pedidoActual = pedidoGuardado._id;
    mesa.historialPedidos.push({ 
      pedido: pedidoGuardado._id, 
      fecha: new Date() 
    });
    await mesa.save();

    console.log('✅ Pedido creado exitosamente:', {
      id: pedidoGuardado._id,
      numeroPedido: numeroPedido,
      mesa: mesaId,
      mesero: mesero.nombre,
      total: total
    });
    
    res.status(201).json({
      success: true,
      message: 'Pedido registrado con éxito',
      pedido: pedidoGuardado
    });

  } catch (error) {
    console.error('❌ Error al crear pedido:', error);
    
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

// ✅ NUEVA RUTA: Cancelar pedido completo
router.post('/:id/cancelar', verifyToken, async (req, res) => {
  try {
    const pedido = await Pedido.findById(req.params.id);
    if (!pedido) {
      return res.status(404).json({ error: 'Pedido no encontrado' });
    }

    // Solo se puede cancelar si está pendiente
    if (pedido.estadoPedido !== 'pendiente' || pedido.estadoPago !== 'pendiente') {
      return res.status(400).json({ 
        error: 'Solo se pueden cancelar pedidos pendientes de pago' 
      });
    }

    // Devolver stock de todos los platos
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
      mesa.estado = 'liberada';
      mesa.pedidoActual = null;
      await mesa.save();
    }

    // Marcar pedido como cancelado
    pedido.estadoPedido = 'cancelado';
    pedido.activo = false;
    await pedido.save();

    res.json({ 
      success: true, 
      message: 'Pedido cancelado correctamente. Stock devuelto y mesa liberada.' 
    });

  } catch (error) {
    console.error('Error al cancelar pedido:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ✅ NUEVA RUTA: Actualizar estado del pedido
router.put('/:id/estado', verifyToken, async (req, res) => {
  try {
    const { estado } = req.body;
    const pedido = await Pedido.findById(req.params.id);
    if (!pedido) {
      return res.status(404).json({ error: 'Pedido no encontrado' });
    }

    pedido.estadoPedido = estado;
    await pedido.save();

    res.json({
      success: true,
      message: 'Estado del pedido actualizado',
      pedido: pedido
    });

  } catch (error) {
    console.error('Error al actualizar estado del pedido:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ✅ NUEVA RUTA: Actualizar estado de un plato específico
router.put('/:pedidoId/platos/:platoIndex/estado', verifyToken, async (req, res) => {
  try {
    const { pedidoId, platoIndex } = req.params;
    const { estado } = req.body;

    const pedido = await Pedido.findById(pedidoId);
    if (!pedido) {
      return res.status(404).json({ error: 'Pedido no encontrado' });
    }

    if (platoIndex < 0 || platoIndex >= pedido.platos.length) {
      return res.status(404).json({ error: 'Plato no encontrado en el pedido' });
    }

    pedido.platos[platoIndex].estado = estado;
    await pedido.save();

    res.json({
      success: true,
      message: 'Estado del plato actualizado',
      pedido: pedido
    });

  } catch (error) {
    console.error('Error al actualizar estado del plato:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});
// ✅ NUEVA RUTA: Agregar platos a pedido existente - CORREGIDA
router.post('/:pedidoId/platos', verifyToken, async (req, res) => {
  try {
    const { pedidoId } = req.params;
    const { platoId, cantidad, observaciones } = req.body;

    console.log('📦 Agregando plato al pedido:', { pedidoId, platoId, cantidad });

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

    // Validar el plato
    const plato = await Platos.findById(platoId);
    if (!plato) {
      return res.status(404).json({ error: 'Plato no encontrado' });
    }

    if (!plato.tieneStock(cantidad)) {
      return res.status(400).json({ 
        error: `Stock insuficiente para: ${plato.nombre}. Stock disponible: ${plato.stock}` 
      });
    }

    // Verificar si el plato ya existe en el pedido
    const platoExistenteIndex = pedido.platos.findIndex(
      p => p.plato.toString() === platoId
    );

    if (platoExistenteIndex !== -1) {
      // Si ya existe, actualizar la cantidad
      const platoExistente = pedido.platos[platoExistenteIndex];
      const nuevaCantidad = platoExistente.cantidad + cantidad;
      
      if (!plato.tieneStock(nuevaCantidad - platoExistente.cantidad)) {
        return res.status(400).json({ 
          error: `Stock insuficiente para: ${plato.nombre}. Stock disponible: ${plato.stock}` 
        });
      }

      // Actualizar stock (diferencia)
      await plato.reducirStock(cantidad);
      
      platoExistente.cantidad = nuevaCantidad;
      platoExistente.subtotal = platoExistente.precio * nuevaCantidad;
      if (observaciones) {
        platoExistente.observaciones = observaciones;
      }
    } else {
      // Si no existe, agregar nuevo plato
      const nuevoPlato = {
        plato: platoId,
        nombre: plato.nombre,
        precio: plato.precio,
        cantidad: cantidad,
        observaciones: observaciones || '',
        subtotal: plato.precio * cantidad,
        estado: 'pendiente'
      };
      
      pedido.platos.push(nuevoPlato);
      await plato.reducirStock(cantidad);
    }

    // Recalcular total
    pedido.total = pedido.platos.reduce((sum, plato) => sum + plato.subtotal, 0);
    
    await pedido.save();

    // Populate para respuesta
    const pedidoActualizado = await Pedido.findById(pedidoId)
      .populate('mesa', 'numeroMesa piso sector')
      .populate('mesero', 'nombre email')
      .populate('platos.plato', 'nombre precio imagen descripcion stock');

    res.json({
      success: true,
      message: 'Plato agregado al pedido exitosamente',
      pedido: pedidoActualizado
    });

  } catch (error) {
    console.error('❌ Error al agregar plato:', error);
    res.status(500).json({ error: 'Error interno del servidor: ' + error.message });
  }
});
// ✅ NUEVA RUTA: Eliminar un plato específico del pedido
router.delete('/:pedidoId/platos/:platoIndex', verifyToken, async (req, res) => {
  try {
    const { pedidoId, platoIndex } = req.params;

    const pedido = await Pedido.findById(pedidoId);
    if (!pedido) {
      return res.status(404).json({ error: 'Pedido no encontrado' });
    }

    if (platoIndex < 0 || platoIndex >= pedido.platos.length) {
      return res.status(404).json({ error: 'Plato no encontrado en el pedido' });
    }

    const platoEliminado = pedido.platos[platoIndex];

    // Devolver stock solo si el pedido está pendiente
    if (pedido.estadoPedido === 'pendiente') {
      const plato = await Platos.findById(platoEliminado.plato);
      if (plato) {
        plato.stock += platoEliminado.cantidad;
        if (plato.stock > 0) {
          plato.disponible = true;
        }
        await plato.save();
      }
    }

    // Eliminar el plato del array
    pedido.platos.splice(platoIndex, 1);

    // Recalcular el total
    pedido.total = pedido.platos.reduce((sum, plato) => sum + plato.subtotal, 0);

    // Si no quedan platos, cancelar el pedido
    if (pedido.platos.length === 0) {
      pedido.estadoPedido = 'cancelado';
      pedido.activo = false;

      // Liberar mesa
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
      message: 'Plato eliminado del pedido',
      pedido: pedido
    });

  } catch (error) {
    console.error('Error al eliminar plato del pedido:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ✅ NUEVA RUTA: Actualizar cantidad de un plato
router.put('/:pedidoId/platos/:platoIndex/cantidad', verifyToken, async (req, res) => {
  try {
    const { pedidoId, platoIndex } = req.params;
    const { cantidad } = req.body;

    const pedido = await Pedido.findById(pedidoId);
    if (!pedido) {
      return res.status(404).json({ error: 'Pedido no encontrado' });
    }

    if (platoIndex < 0 || platoIndex >= pedido.platos.length) {
      return res.status(404).json({ error: 'Plato no encontrado en el pedido' });
    }

    const platoPedido = pedido.platos[platoIndex];
    const plato = await Platos.findById(platoPedido.plato);

    // Calcular la diferencia de cantidad
    const diferencia = cantidad - platoPedido.cantidad;

    // Solo permitir modificar si el pedido está pendiente
    if (pedido.estadoPedido !== 'pendiente') {
      return res.status(400).json({ 
        error: 'Solo se pueden modificar platos en pedidos pendientes' 
      });
    }

    // Verificar si hay suficiente stock para aumentar la cantidad
    if (diferencia > 0) {
      if (!plato.tieneStock(diferencia)) {
        return res.status(400).json({ 
          error: `Stock insuficiente para: ${plato.nombre}. Stock disponible: ${plato.stock}` 
        });
      }
      // Reducir el stock adicional
      await plato.reducirStock(diferencia);
    } else if (diferencia < 0) {
      // Devolver el stock si se reduce la cantidad
      plato.stock += Math.abs(diferencia);
      if (plato.stock > 0) {
        plato.disponible = true;
      }
      await plato.save();
    }

    // Actualizar la cantidad y el subtotal
    platoPedido.cantidad = cantidad;
    platoPedido.subtotal = platoPedido.precio * cantidad;

    // Recalcular el total del pedido
    pedido.total = pedido.platos.reduce((sum, plato) => sum + plato.subtotal, 0);

    await pedido.save();

    res.json({
      success: true,
      message: 'Cantidad actualizada',
      pedido: pedido
    });

  } catch (error) {
    console.error('Error al actualizar cantidad del plato:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// RF012: Adición de nuevos pedidos a mesas existentes
router.post('/:pedidoId/agregar-platos', verifyToken, async (req, res) => {
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

      // Actualizar stock usando el método del modelo
      await plato.reducirStock(item.cantidad);
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
router.get('/mesa/:mesaId', verifyToken, async (req, res) => {
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
router.put('/mesa/:mesaId/liberar', verifyToken, async (req, res) => {
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

// Obtener todos los pedidos
router.get('/', verifyToken, async (req, res) => {
  try {
    const { estado, fecha } = req.query;
    const filtro = { activo: true };
    
    if (estado) {
      filtro.estadoPedido = estado;
    }

    // Filtrar por fecha actual si no se especifica fecha
    if (!fecha) {
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);
      const manana = new Date(hoy);
      manana.setDate(manana.getDate() + 1);
      
      filtro.fechaPedido = { $gte: hoy, $lt: manana };
    }

    const pedidos = await Pedido.find(filtro)
      .populate('mesa', 'numeroMesa piso sector estado')
      .populate('mesero', 'nombre email')
      .populate('platos.plato', 'nombre precio imagen')
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

// ✅ NUEVA RUTA: Obtener pedidos pagados
router.get('/pagados', verifyToken, async (req, res) => {
  try {
    const { fecha } = req.query;
    const filtro = { activo: true, estadoPago: 'pagado' };

    // Filtrar por fecha actual si no se especifica fecha
    if (!fecha) {
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);
      const manana = new Date(hoy);
      manana.setDate(manana.getDate() + 1);

      filtro.fechaPedido = { $gte: hoy, $lt: manana };
    } else {
      const fechaFiltro = new Date(fecha);
      fechaFiltro.setHours(0, 0, 0, 0);
      const fechaSiguiente = new Date(fechaFiltro);
      fechaSiguiente.setDate(fechaSiguiente.getDate() + 1);
      filtro.fechaPedido = { $gte: fechaFiltro, $lt: fechaSiguiente };
    }

    const pedidosPagados = await Pedido.find(filtro)
      .populate('mesa', 'numeroMesa piso sector')
      .populate('mesero', 'nombre email')
      .populate('platos.plato', 'nombre precio imagen')
      .sort({ fechaPedido: -1 });

    res.json({
      success: true,
      pedidos: pedidosPagados
    });

  } catch (error) {
    console.error('Error al obtener pedidos pagados:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});


// Obtener pedido por ID
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const pedido = await Pedido.findById(req.params.id)
      .populate('mesa', 'numeroMesa piso sector estado')
      .populate('mesero', 'nombre email')
      .populate('platos.plato', 'nombre precio imagen descripcion');

    if (!pedido) {
      return res.status(404).json({ error: 'Pedido no encontrado' });
    }

    res.json({
      success: true,
      pedido: pedido
    });

  } catch (error) {
    console.error('Error al obtener pedido:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ✅ NUEVA RUTA: Obtener pedidos del día actual
router.get('/hoy/pedidos', verifyToken, async (req, res) => {
  try {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const manana = new Date(hoy);
    manana.setDate(manana.getDate() + 1);

    const pedidos = await Pedido.find({
      fechaPedido: { $gte: hoy, $lt: manana },
      activo: true
    })
    .populate('mesa', 'numeroMesa piso sector')
    .populate('mesero', 'nombre')
    .populate('platos.plato', 'nombre precio')
    .sort({ fechaPedido: -1 });

    res.json({
      success: true,
      pedidos: pedidos
    });
  } catch (error) {
    console.error('Error al obtener pedidos de hoy:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});



module.exports = router;