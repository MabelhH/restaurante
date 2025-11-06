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

// Ruta principal de pedidos (según rol) - CORREGIDA
router.get('/', verifyToken, async (req, res) => {
  try {
    let filtroPedidos = { activo: true };
    
    // Si es mesero, solo ver sus pedidos
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

    // Preparar datos del usuario
    const userData = {
      _id: req.user._id,
      nombre: req.user.nombre,
      email: req.user.email,
      rol: req.user.rol
    };

    console.log('📋 Cargando pedidos:', {
      usuario: userData.nombre,
      rol: userData.rol,
      totalPedidos: pedidos.length
    });

    if (req.user.rol === 'admin') {
      res.render('pedidos', { 
        usuario: userData, 
        pedidos, 
        mesas, 
        platos,
        pedidoActual: null // ✅ Agregado
      });
    } else if (req.user.rol === 'mesero') {
      res.render('pedidosM', { 
        usuario: userData, 
        pedidos, 
        mesas, 
        platos,
        pedidoActual: null // ✅ Agregado
      });
    } else {
      res.status(403).send('Acceso denegado');
    }
  } catch (error) {
    console.error('❌ Error al cargar pedidos:', error);
    res.status(500).send('Error al cargar pedidos');
  }
});

// Ruta para ver pedidos específicos (si necesitas una vista de detalle)
router.get('/ver', verifyToken, async (req, res) => {
  try {
    let filtroPedidos = { activo: true };
    
    // Si es mesero, solo ver sus pedidos
    if (req.user.rol === 'mesero') {
      filtroPedidos.mesero = req.user._id;
    }

    const pedidos = await Pedido.find(filtroPedidos)
      .populate('mesa', 'numeroMesa piso sector')
      .populate('mesero', 'nombre')
      .populate('platos.plato', 'nombre precio imagen descripcion')
      .sort({ fechaPedido: -1 });

    const userData = {
      _id: req.user._id,
      nombre: req.user.nombre,
      email: req.user.email,
      rol: req.user.rol
    };

    console.log('👀 Vista detallada de pedidos:', {
      usuario: userData.nombre,
      totalPedidos: pedidos.length
    });

    if (req.user.rol === 'admin') {
      res.render('pedidosDetalle', { 
        usuario: userData, 
        pedidos 
      });
    } else if (req.user.rol === 'mesero') {
      res.render('pedidosM', { 
        usuario: userData, 
        pedidos,
        pedidoActual: null // ✅ Agregado
      });
    }
  } catch (error) {
    console.error('❌ Error al cargar vista de pedidos:', error);
    res.status(500).send('Error al cargar pedidos');
  }
});

// Las otras rutas permanecen igual...
router.get('/nuevo', verifyToken, async (req, res) => {
  try {
    const mesas = await Mesa.find({ estado: 'disponible' });
    const platos = await Platos.find({ estado: 'activo', stock: { $gt: 0 } });

    const userData = {
      _id: req.user._id,
      nombre: req.user.nombre,
      email: req.user.email,
      rol: req.user.rol
    };

    if (req.user.rol === 'admin') {
      res.render('nuevoPedido', { 
        usuario: userData, 
        mesas, 
        platos 
      });
    } else if (req.user.rol === 'mesero') {
      res.render('nuevoPedidoM', { 
        usuario: userData, 
        mesas, 
        platos 
      });
    } else {
      res.status(403).send('Acceso denegado');
    }
  } catch (error) {
    console.error('Error al cargar formulario de pedido:', error);
    res.status(500).send('Error al cargar formulario');
  }
});

router.get('/:id', verifyToken, async (req, res) => {
  try {
    const pedido = await Pedido.findById(req.params.id)
      .populate('mesa', 'numeroMesa piso sector')
      .populate('mesero', 'nombre email')
      .populate('platos.plato', 'nombre precio imagen descripcion');

    if (!pedido) {
      return res.status(404).send('Pedido no encontrado');
    }

    const userData = {
      _id: req.user._id,
      nombre: req.user.nombre,
      email: req.user.email,
      rol: req.user.rol
    };

    if (req.user.rol === 'admin') {
      res.render('detallePedido', { 
        usuario: userData, 
        pedido 
      });
    } else if (req.user.rol === 'mesero') {
      res.render('detallePedidoM', { 
        usuario: userData, 
        pedido 
      });
    } else {
      res.status(403).send('Acceso denegado');
    }
  } catch (error) {
    console.error('Error al cargar pedido:', error);
    res.status(500).send('Error al cargar pedido');
  }
});

module.exports = router;