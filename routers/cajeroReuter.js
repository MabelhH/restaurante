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

// Dashboard del cajero
router.get('/dashboard', verifyToken, async (req, res) => {
  try {
    // Solo cajero y admin pueden acceder
    if (req.user.rol !== 'cajero' && req.user.rol !== 'admin') {
      return res.status(403).send('Acceso denegado');
    }

    const pedidos = await Pedido.find({ activo: true })
      .populate('mesa', 'numeroMesa piso sector')
      .populate('mesero', 'nombre')
      .populate('platos.plato', 'nombre precio imagen')
      .sort({ fechaPedido: -1 });

    // Formatear los datos para la vista
    const pedidosFormateados = pedidos.map(pedido => {
      // Calcular si el pedido pagado puede ser cancelado (5 minutos)
      let puedeCancelar = false;
      if (pedido.estadoPago === 'pendiente') {
        puedeCancelar = true;
      } else if (pedido.estadoPago === 'pagado' && pedido.fechaPago) {
        const ahora = new Date();
        const fechaPago = new Date(pedido.fechaPago);
        const diferenciaMinutos = (ahora - fechaPago) / (1000 * 60);
        if (diferenciaMinutos <= 5) {
          puedeCancelar = true;
        }
      }

      return {
        ...pedido._doc,
        puedeCancelar
      };
    });

    res.render('dashboardCajero', {
      usuario: req.user,
      pedidos: pedidosFormateados
    });
  } catch (error) {
    console.error('Error al cargar dashboard del cajero:', error);
    res.status(500).send('Error interno del servidor');
  }
});

module.exports = router;