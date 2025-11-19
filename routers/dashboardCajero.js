// routes/dashboardCajero.js
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const SECRET_KEY = 'tu_clave_secreta_aqui';

const Pedido = require('../models/pedidosModel');
const Venta = require('../models/ventaModel');
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

// Ruta principal del dashboard del cajero
router.get('/', verifyToken, async (req, res) => {
  try {
    const userData = {
      ...req.user,
      _id: req.user._id || req.user.id
    };

    res.render('dashboard_cajero', { 
      usuario: userData
    });
  } catch (error) {
    console.error('Error al cargar dashboard cajero:', error);
    res.status(500).send('Error al cargar dashboard');
  }
});

// Ruta para obtener datos del dashboard - CORREGIDA
router.get('/datos', verifyToken, async (req, res) => {
  try {
    const hoy = new Date();
    const inicioDia = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
    const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    
    console.log('📊 Calculando estadísticas...');
    console.log('📅 Hoy:', inicioDia);
    console.log('📅 Inicio mes:', inicioMes);

    // CORREGIDO: Ventas del día usando fechaVenta
    const ventasHoy = await Venta.aggregate([
      {
        $match: {
          fechaVenta: { $gte: inicioDia }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$total' },
          count: { $sum: 1 }
        }
      }
    ]);

    console.log('💰 Ventas hoy:', ventasHoy);

    // CORREGIDO: Ventas del mes usando fechaVenta
    const ventasMes = await Venta.aggregate([
      {
        $match: {
          fechaVenta: { $gte: inicioMes }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$total' },
          count: { $sum: 1 }
        }
      }
    ]);

    console.log('📈 Ventas mes:', ventasMes);

    // Pedidos pendientes de pago
    const pedidosPendientes = await Pedido.countDocuments({
      estadoPago: { $in: ['pendiente', 'parcial'] },
      activo: true
    });

    console.log('⏳ Pedidos pendientes:', pedidosPendientes);

    // Métodos de pago más usados - CORREGIDO
    const metodosPago = await Venta.aggregate([
      {
        $match: {
          fechaVenta: { $gte: inicioMes }
        }
      },
      {
        $group: {
          _id: '$metodoPago',
          count: { $sum: 1 },
          total: { $sum: '$total' }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);

    console.log('💳 Métodos de pago:', metodosPago);

    // Estado de pedidos
    const estadoPedidos = await Pedido.aggregate([
      {
        $match: { activo: true }
      },
      {
        $group: {
          _id: '$estadoPago',
          count: { $sum: 1 }
        }
      }
    ]);

    console.log('📦 Estado pedidos:', estadoPedidos);

    // Ventas de los últimos 7 días - CORREGIDO
    const ultimos7Dias = [];
    for (let i = 6; i >= 0; i--) {
      const fecha = new Date();
      fecha.setDate(fecha.getDate() - i);
      fecha.setHours(0, 0, 0, 0);
      ultimos7Dias.push(fecha);
    }

    const ventasUltimos7Dias = await Venta.aggregate([
      {
        $match: {
          fechaVenta: { 
            $gte: ultimos7Dias[0],
            $lte: new Date()
          }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$fechaVenta' }
          },
          total: { $sum: '$total' },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);

    console.log('📊 Ventas últimos 7 días:', ventasUltimos7Dias);

    // Formatear ventas de los últimos 7 días
    const ventasPorDiaFormateadas = ultimos7Dias.map(fecha => {
      const fechaStr = fecha.toISOString().split('T')[0];
      const ventaDia = ventasUltimos7Dias.find(v => v._id === fechaStr);
      return {
        fecha: fecha.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }),
        total: ventaDia ? ventaDia.total : 0
      };
    });

    // Ventas recientes (últimas 5 ventas) - CORREGIDO
    const ventasRecientes = await Venta.find({
      fechaVenta: { $gte: inicioDia }
    })
      .populate('mesa', 'numeroMesa')
      .populate('mesero', 'nombre')
      .sort({ fechaVenta: -1 })
      .limit(5);

    console.log('🆕 Ventas recientes:', ventasRecientes);

    // Preparar datos de respuesta
    const datosResponse = {
      estadisticas: {
        ventasHoy: {
          total: ventasHoy[0]?.total || 0,
          count: ventasHoy[0]?.count || 0
        },
        ventasMes: {
          total: ventasMes[0]?.total || 0,
          count: ventasMes[0]?.count || 0
        },
        pedidosPendientes: pedidosPendientes
      },
      metodosPago: metodosPago,
      estadoPedidos: estadoPedidos,
      ventasPorDia: ventasPorDiaFormateadas,
      ventasRecientes: ventasRecientes
    };

    console.log('✅ Datos finales preparados:', datosResponse);

    res.json({
      success: true,
      datos: datosResponse
    });

  } catch (error) {
    console.error('❌ Error al obtener datos del dashboard:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error interno del servidor: ' + error.message 
    });
  }
});

module.exports = router;