const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const SECRET_KEY = 'tu_clave_secreta_aqui';

const Venta = require('../models/ventaModel');

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

// Ruta principal de ventas
router.get('/', verifyToken, async (req, res) => {
  try {
    const { fecha, metodoPago } = req.query;
    const filtro = {};

    if (fecha) {
      const startDate = new Date(fecha);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 1);
      filtro.fechaVenta = { $gte: startDate, $lt: endDate };
    }

    if (metodoPago) filtro.metodoPago = metodoPago;

    const ventas = await Venta.find(filtro)
      .populate('mesa', 'numeroMesa')
      .populate('mesero', 'nombre')
      .populate('platos.plato', 'nombre precio')
      .sort({ fechaVenta: -1 });

    const totalHoy = ventas.reduce((sum, venta) => sum + venta.total, 0);

    // CORREGIDO: Pasar el usuario con _id
    const userData = {
      ...req.user,
      _id: req.user._id || req.user.id // Compatibilidad con ambos
    };

    if (req.user.rol === 'admin') {
      res.render('ventas', { 
        usuario: userData, 
        ventas, 
        totalHoy,
        filtros: { fecha, metodoPago }
      });
    } else {
      res.status(403).send('Acceso denegado');
    }
  } catch (error) {
    console.error('Error al cargar ventas:', error);
    res.status(500).send('Error al cargar ventas');
  }
});

// Ruta para estadísticas de ventas
router.get('/estadisticas', verifyToken, async (req, res) => {
  try {
    if (req.user.rol !== 'admin') {
      return res.status(403).send('Acceso denegado');
    }

    const { fechaInicio, fechaFin } = req.query;
    
    // CORREGIDO: Pasar el usuario con _id
    const userData = {
      ...req.user,
      _id: req.user._id || req.user.id // Compatibilidad con ambos
    };

    res.render('estadisticasVentas', { 
      usuario: userData,
      fechaInicio: fechaInicio || '',
      fechaFin: fechaFin || ''
    });
  } catch (error) {
    console.error('Error al cargar estadísticas:', error);
    res.status(500).send('Error al cargar estadísticas');
  }
});

module.exports = router;