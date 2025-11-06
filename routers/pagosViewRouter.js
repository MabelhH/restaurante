// routers/pagosViewRouter.js
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const SECRET_KEY = 'tu_clave_secreta_aqui';

const Pedido = require('../models/pedidosModel');

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
      estadoPago: 'pendiente',
      activo: true 
    })
    .populate('mesa', 'numeroMesa piso sector')
    .populate('mesero', 'nombre')
    .populate('platos.plato', 'nombre precio imagen')
    .sort({ fechaPedido: 1 });

    if (req.user.rol === 'admin') {
      res.render('pagos', { usuario: req.user, pedidos });
    } else if (req.user.rol === 'mesero') {
      res.render('pagosM', { usuario: req.user, pedidos });
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
      .populate('mesa', 'numeroMesa')
      .populate('mesero', 'nombre')
      .populate('platos.plato', 'nombre precio');

    if (!pedido) {
      return res.status(404).send('Pedido no encontrado');
    }

    if (req.user.rol === 'admin') {
      res.render('procesarPago', { usuario: req.user, pedido });
    } else if (req.user.rol === 'mesero') {
      res.render('procesarPagoM', { usuario: req.user, pedido });
    } else {
      res.status(403).send('Acceso denegado');
    }
  } catch (error) {
    console.error('Error al cargar pago:', error);
    res.status(500).send('Error al cargar pago');
  }
});

module.exports = router;