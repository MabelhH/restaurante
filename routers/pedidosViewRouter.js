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
    console.error('❌ Error en verifyToken:', err.message); // 👈 MEJORA: Log del error
    res.clearCookie('token');
    return res.redirect('/login');
  }
}

// MEJORA: Middleware para verificar rol de mesero o admin
function verifyMeseroOrAdmin(req, res, next) {
  if (req.user.rol !== 'mesero' && req.user.rol !== 'admin') {
    return res.status(403).render('error', { 
      mensaje: 'Acceso denegado. Solo meseros y administradores pueden acceder a esta sección.' 
    });
  }
  next();
}

// Ruta principal de pedidos (según rol)
router.get('/', verifyToken, verifyMeseroOrAdmin, async (req, res) => { // 👈 AGREGAR middleware
  try {
    let filtroPedidos = { activo: true };
    
    // MEJORA: Si es mesero, solo ver sus pedidos
    if (req.user.rol === 'mesero') {
      filtroPedidos.mesero = req.user._id;
    }

    const pedidos = await Pedido.find(filtroPedidos)
      .populate('mesa', 'numeroMesa piso sector')
      .populate('mesero', 'nombre')
      .populate('platos.plato', 'nombre precio imagen')
      .sort({ fechaPedido: -1 });

    const mesas = await Mesa.find({ estado: { $in: ['disponible', 'ocupada'] } });
    const platos = await Platos.find({ estado: 'activo', stock: { $gt: 0 } });

    // MEJORA: Simplificar userData
    const userData = {
      _id: req.user._id,
      nombre: req.user.nombre,
      email: req.user.email,
      rol: req.user.rol
    };

    console.log('👤 Usuario cargando pedidos:', userData); // 👈 DEBUG

    if (req.user.rol === 'admin') {
      res.render('pedidos', { usuario: userData, pedidos, mesas, platos });
    } else if (req.user.rol === 'mesero') {
      res.render('pedidosM', { usuario: userData, pedidos, mesas, platos });
    }

  } catch (error) {
    console.error('❌ Error al cargar pedidos:', error);
    res.status(500).render('error', { mensaje: 'Error al cargar los pedidos' });
  }
});

// Ruta para crear nuevo pedido (vista de formulario)
router.get('/nuevo', verifyToken, verifyMeseroOrAdmin, async (req, res) => {
  try {
    const mesas = await Mesa.find({ estado: 'disponible' });
    const platos = await Platos.find({ estado: 'activo', stock: { $gt: 0 } });

    const userData = {
      _id: req.user._id,
      nombre: req.user.nombre,
      email: req.user.email,
      rol: req.user.rol
    };

    console.log('👤 Mesero creando pedido:', userData); // 👈 DEBUG

    if (req.user.rol === 'admin') {
      res.render('nuevoPedido', { usuario: userData, mesas, platos });
    } else if (req.user.rol === 'mesero') {
      res.render('nuevoPedidoM', { usuario: userData, mesas, platos });
    }

  } catch (error) {
    console.error('❌ Error al cargar formulario de pedido:', error);
    res.status(500).render('error', { mensaje: 'Error al cargar el formulario' });
  }
});

// Ruta para ver detalle de pedido específico
router.get('/:id', verifyToken, verifyMeseroOrAdmin, async (req, res) => {
  try {
    let pedido = await Pedido.findById(req.params.id)
      .populate('mesa', 'numeroMesa piso sector')
      .populate('mesero', 'nombre email')
      .populate('platos.plato', 'nombre precio imagen descripcion');

    if (!pedido) {
      return res.status(404).render('error', { mensaje: 'Pedido no encontrado' });
    }

    // MEJORA: Si es mesero, verificar que el pedido sea suyo
    if (req.user.rol === 'mesero' && pedido.mesero._id.toString() !== req.user._id) {
      return res.status(403).render('error', { 
        mensaje: 'No tienes permisos para ver este pedido' 
      });
    }

    const userData = {
      _id: req.user._id,
      nombre: req.user.nombre,
      email: req.user.email,
      rol: req.user.rol
    };

    if (req.user.rol === 'admin') {
      res.render('detallePedido', { usuario: userData, pedido });
    } else if (req.user.rol === 'mesero') {
      res.render('detallePedidoM', { usuario: userData, pedido });
    }

  } catch (error) {
    console.error('❌ Error al cargar pedido:', error);
    res.status(500).render('error', { mensaje: 'Error al cargar el pedido' });
  }
});

module.exports = router;