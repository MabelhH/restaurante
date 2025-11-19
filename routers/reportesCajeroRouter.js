// routers/reportesCajeroRouter.js
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const SECRET_KEY = 'tu_clave_secreta_aqui';

const Venta = require('../models/ventaModel');
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

// Ruta principal de reportes del cajero
router.get('/', verifyToken, async (req, res) => {
  try {
    // Verificar que el usuario sea cajero
    if (req.user.rol !== 'cajero') {
      return res.status(403).send('Acceso denegado');
    }

    const userData = {
      ...req.user,
      _id: req.user._id || req.user.id
    };

    res.render('reportesC', { 
      usuario: userData
    });
  } catch (error) {
    console.error('Error al cargar reportes cajero:', error);
    res.status(500).send('Error al cargar reportes');
  }
});

// Ruta para obtener datos de reportes del cajero
router.get('/datos', verifyToken, async (req, res) => {
  try {
    // Verificar que el usuario sea cajero
    if (req.user.rol !== 'cajero') {
      return res.status(403).json({ success: false, error: 'Acceso denegado' });
    }

    const { periodo, fechaInicio, fechaFin } = req.query;
    
    let startDate, endDate;
    const hoy = new Date();

    // Determinar el rango de fechas según el período
    switch (periodo) {
      case 'hoy':
        startDate = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
        endDate = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate(), 23, 59, 59);
        break;
      case 'ayer':
        const ayer = new Date(hoy);
        ayer.setDate(ayer.getDate() - 1);
        startDate = new Date(ayer.getFullYear(), ayer.getMonth(), ayer.getDate());
        endDate = new Date(ayer.getFullYear(), ayer.getMonth(), ayer.getDate(), 23, 59, 59);
        break;
      case 'semana':
        startDate = new Date(hoy);
        startDate.setDate(hoy.getDate() - 7);
        endDate = new Date(hoy);
        break;
      case 'mes':
        startDate = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
        endDate = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0, 23, 59, 59);
        break;
      case 'personalizado':
        if (fechaInicio && fechaFin) {
          startDate = new Date(fechaInicio);
          endDate = new Date(fechaFin);
          endDate.setHours(23, 59, 59, 999);
        } else {
          startDate = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - 30);
          endDate = new Date(hoy);
        }
        break;
      default:
        startDate = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - 30);
        endDate = new Date(hoy);
    }

    console.log('📊 Cajero - Generando reportes desde:', startDate, 'hasta:', endDate);

    // Ventas totales en el período
    const ventasPeriodo = await Venta.aggregate([
      {
        $match: {
          fechaVenta: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: null,
          totalVentas: { $sum: '$total' },
          cantidadVentas: { $sum: 1 },
          promedioVenta: { $avg: '$total' }
        }
      }
    ]);

    // Ventas por día (para gráfico)
    const ventasPorDia = await Venta.aggregate([
      {
        $match: {
          fechaVenta: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$fechaVenta' }
          },
          total: { $sum: '$total' },
          cantidad: { $sum: 1 }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);

    // Métodos de pago
    const metodosPago = await Venta.aggregate([
      {
        $match: {
          fechaVenta: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: '$metodoPago',
          total: { $sum: '$total' },
          cantidad: { $sum: 1 }
        }
      },
      {
        $sort: { total: -1 }
      }
    ]);

    // Ventas detalladas para la tabla
    const ventasDetalladas = await Venta.find({
      fechaVenta: { $gte: startDate, $lte: endDate }
    })
      .populate('mesa', 'numeroMesa')
      .populate('mesero', 'nombre')
      .sort({ fechaVenta: -1 })
      .limit(50);

    const datos = {
      resumen: ventasPeriodo[0] || { totalVentas: 0, cantidadVentas: 0, promedioVenta: 0 },
      ventasPorDia: ventasPorDia,
      metodosPago: metodosPago,
      ventasDetalladas: ventasDetalladas,
      periodo: {
        inicio: startDate,
        fin: endDate,
        tipo: periodo || '30dias'
      }
    };

    console.log('✅ Reportes cajero generados correctamente');

    res.json({
      success: true,
      datos: datos
    });

  } catch (error) {
    console.error('❌ Error al generar reportes cajero:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error interno del servidor: ' + error.message 
    });
  }
});

module.exports = router;