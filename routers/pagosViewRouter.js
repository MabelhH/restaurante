const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const SECRET_KEY = 'tu_clave_secreta_aqui';

const Pedido = require('../models/pedidosModel');
const Mesa = require('../models/mesasModel');

// Middleware para verificar el token
function verifyToken(req, res, next) {
  const token = req.cookies.token;
  if (!token) return res.redirect('/login');

  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    req.user = decoded;
    next();
  } catch (err) {
    res.clearCookie('token');
    return res.redirect('/login');
  }
}

// Ruta principal de pagos (según rol)
router.get('/', verifyToken, async (req, res) => {
  try {
    const pedidos = await Pedido.find({ 
      estadoPago: { $in: ['pendiente', 'parcial'] },
      activo: true 
    })
    .populate('mesa', 'numeroMesa piso sector')
    .populate('mesero', 'nombre')
    .populate('platos.plato', 'nombre precio imagen')
    .sort({ fechaPedido: 1 });

    // CORREGIDO: Pasar el usuario con _id
    const userData = {
      ...req.user,
      _id: req.user._id || req.user.id // Compatibilidad con ambos
    };

    if (req.user.rol === 'admin') {
      res.render('pagos', { usuario: userData, pedidos });
    } else if (req.user.rol === 'cajero') {
      res.render('pagos', { usuario: userData, pedidos });
    } else if (req.user.rol === 'mesero') {
      res.render('pagosM', { usuario: userData, pedidos });
    } else {
      res.status(403).send('Acceso denegado');
    }
  } catch (error) {
    console.error('Error al cargar pagos:', error);
    res.status(500).send('Error al cargar pagos');
  }
});

// Ruta para procesar pago (vista de formulario)
router.get('/procesar/:id', verifyToken, async (req, res) => {
  try {
    const pedido = await Pedido.findById(req.params.id)
      .populate('mesa', 'numeroMesa piso sector')
      .populate('mesero', 'nombre')
      .populate('platos.plato', 'nombre precio');

    if (!pedido) {
      return res.status(404).send('Pedido no encontrado');
    }

    // Calcular total pagado hasta ahora
    const totalPagado = pedido.historialPagos.reduce((sum, pago) => sum + pago.monto, 0);
    const pendiente = pedido.total - totalPagado;

    // CORREGIDO: Pasar el usuario con _id
    const userData = {
      ...req.user,
      _id: req.user._id || req.user.id // Compatibilidad con ambos
    };

    if (req.user.rol === 'admin') {
      res.render('procesarPago', { 
        usuario: userData, 
        pedido,
        totalPagado,
        pendiente
      });
    } else if (req.user.rol === 'cajero') {
      res.render('procesarPagoCajero', { 
        usuario: userData, 
        pedido,
        totalPagado,
        pendiente
      });
    } else if (req.user.rol === 'mesero') {
      res.render('procesarPagoM', { 
        usuario: userData, 
        pedido,
        totalPagado,
        pendiente
      });
    } else {
      res.status(403).send('Acceso denegado');
    }
  } catch (error) {
    console.error('Error al cargar pago:', error);
    res.status(500).send('Error al cargar pago');
  }
});

// Ruta para ver historial de pagos
router.get('/historial/:id', verifyToken, async (req, res) => {
  try {
    const pedido = await Pedido.findById(req.params.id)
      .populate('mesa', 'numeroMesa')
      .populate('mesero', 'nombre')
      .populate('platos.plato', 'nombre precio');

    if (!pedido) {
      return res.status(404).send('Pedido no encontrado');
    }

    const totalPagado = pedido.historialPagos.reduce((sum, pago) => sum + pago.monto, 0);
    const pendiente = pedido.total - totalPagado;

    // CORREGIDO: Pasar el usuario con _id
    const userData = {
      ...req.user,
      _id: req.user._id || req.user.id // Compatibilidad con ambos
    };

    res.render('historialPago', {
      usuario: userData,
      pedido,
      historialPagos: pedido.historialPagos,
      totalPagado,
      pendiente
    });

  } catch (error) {
    console.error('Error al cargar historial de pago:', error);
    res.status(500).send('Error al cargar historial de pago');
  }
});

module.exports = router;