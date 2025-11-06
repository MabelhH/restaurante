// routers/pedidosViewRouter.js
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const SECRET_KEY = 'tu_clave_secreta_aqui';

const Pedido = require('../models/pedidosModel');
const Mesa = require('../models/mesasModel');
const Platos = require('../models/platosModel');

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

// Ruta principal de pedidos (según rol)
router.get('/', verifyToken, async (req, res) => {
  try {
    const pedidos = await Pedido.find({ activo: true })
      .populate('mesa', 'numeroMesa piso sector')
      .populate('mesero', 'nombre')
      .populate('platos.plato', 'nombre precio imagen')
      .sort({ fechaPedido: -1 });

    const mesas = await Mesa.find({ estado: { $in: ['disponible', 'ocupada'] } });
    const platos = await Platos.find({ estado: 'activo', stock: { $gt: 0 } });

    if (req.user.rol === 'admin') {
      res.render('pedidos', { usuario: req.user, pedidos, mesas, platos });
    } else if (req.user.rol === 'mesero') {
      res.render('pedidosM', { usuario: req.user, pedidos, mesas, platos });
    } else {
      res.status(403).send('Acceso denegado');
    }
  } catch (error) {
    console.error('Error al cargar pedidos:', error);
    res.status(500).send('Error al cargar pedidos');
  }
});

// Ruta para crear nuevo pedido (vista de formulario)
router.get('/nuevo', verifyToken, async (req, res) => {
  try {
    const mesas = await Mesa.find({ estado: 'disponible' });
    const platos = await Platos.find({ estado: 'activo', stock: { $gt: 0 } });

    if (req.user.rol === 'admin') {
      res.render('nuevoPedido', { usuario: req.user, mesas, platos });
    } else if (req.user.rol === 'mesero') {
      res.render('nuevoPedidoM', { usuario: req.user, mesas, platos });
    } else {
      res.status(403).send('Acceso denegado');
    }
  } catch (error) {
    console.error('Error al cargar formulario de pedido:', error);
    res.status(500).send('Error al cargar formulario');
  }
});

// Ruta para ver detalle de pedido específico
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const pedido = await Pedido.findById(req.params.id)
      .populate('mesa', 'numeroMesa piso sector')
      .populate('mesero', 'nombre email')
      .populate('platos.plato', 'nombre precio imagen descripcion');

    if (!pedido) {
      return res.status(404).send('Pedido no encontrado');
    }

    if (req.user.rol === 'admin') {
      res.render('detallePedido', { usuario: req.user, pedido });
    } else if (req.user.rol === 'mesero') {
      res.render('detallePedidoM', { usuario: req.user, pedido });
    } else {
      res.status(403).send('Acceso denegado');
    }
  } catch (error) {
    console.error('Error al cargar pedido:', error);
    res.status(500).send('Error al cargar pedido');
  }
});

module.exports = router;