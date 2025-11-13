// routers/userViewRouter.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const userController = require('../controllers/userController');
const dashboardController = require('../controllers/dashboardController');
const Usuario = require('../models/userModel');
const Pedido = require('../models/pedidosModel');
const Platos = require('../models/platosModel');
const reporteController = require('../controllers/reporteController');

// Importar middleware
const { verifyToken } = userController;

router.get('/login', (req, res) => res.render('login', { error: null }));
router.get('/register', (req, res) => res.render('register', { error: null }));

router.post('/login', userController.login);
router.post('/register', userController.register);

router.get('/register_admin', verifyToken, async (req, res) => {
  try {
    const users = await Usuario.find().lean();
    res.render('register_admin', { user: req.user, users, error: null, success: null });
  } catch (err) {
    console.error('Error cargar register_admin:', err);
    res.render('register_admin', { user: req.user, users: [], error: 'Error cargando usuarios', success: null });
  }
});

router.post('/register_admin', verifyToken, async (req, res) => {
  try {
    const { nombre, apellido, email, password, rol } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const nuevoUsuario = new Usuario({ nombre, apellido, email, password: hashedPassword, rol });
    await nuevoUsuario.save();
    const users = await Usuario.find().lean();
    res.render('register_admin', { 
      user: req.user, 
      users, 
      error: null, 
      success: `El usuario registrado correctamente como ${rol}`  
    });
  } catch (error) {
    console.error('Error registrar admin:', error);
    const users = await Usuario.find().lean();
    res.render('register_admin', { user: req.user, users, error: 'Error al registrar usuario', success: null });
  }
});

// DASHBOARD principal (vista)
// Nota: esta ruta está protegida por verifyToken para mostrar datos del sistema
router.get('/dashboard', verifyToken, async (req, res) => {
  try {
    // 1) Pedidos pagados (para totales acumulados)
    const pedidosPagados = await Pedido.find({ estadoPago: 'pagado' }).lean();

    // ventasTotales / gananciaTotal (alias)
    const ventasTotales = pedidosPagados.reduce((s, p) => s + (Number(p.total) || 0), 0);
    const gananciaTotal = ventasTotales;

    // 2) Pedidos totales (todos)
    const totalPedidos = await Pedido.countDocuments();

    // 3) Pedidos de hoy
    const todayStart = new Date();
    todayStart.setHours(0,0,0,0);
    const todayEnd = new Date();
    todayEnd.setHours(23,59,59,999);
    const pedidosHoy = await Pedido.countDocuments({ fechaPedido: { $gte: todayStart, $lte: todayEnd } });

    // 4) Platos disponibles (activos y stock > 0)
    const platosDisponibles = await Platos.countDocuments({ estado: 'activo', stock: { $gt: 0 } });

    // 5) Pedidos recientes (últimos 5) - con mesero y platos poblados para la vista
    const pedidosRecientes = await Pedido.find()
      .sort({ fechaPedido: -1 })
      .limit(5)
      .populate('mesero', 'nombre apellido')
      .lean();

    // 6) Total de empleados
    const totalEmpleados = await Usuario.countDocuments({}); // todos los usuarios (puedes filtrar por rol si quieres)

    // 7) Empleados en línea - si no tienes tracking en tiempo real, dejar 0.
    // (Si en el futuro guardas un campo 'online' en Usuario, reemplaza la query)
    let empleadosLinea = 0;
    try {
      // intento de contar campo 'online' por si existe:
      empleadosLinea = await Usuario.countDocuments({ online: true });
    } catch (err) {
      empleadosLinea = 0;
    }

    // 8) Datos para la gráfica: ingresos por mes (últimos 12 meses)
    const now = new Date();
    const monthsArr = [];
    const revenuesMap = {}; // { '2025-01': value, ... } keyed by YYYY-MM for ordering

    // preparar 12 meses hacia atrás
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; // e.g. "2025-11"
      monthsArr.push({ key, label: d.toLocaleString('es-PE', { month: 'short' }) });
      revenuesMap[key] = 0;
    }

    // obtener pedidos en rango de 12 meses para sumar (optimizar la query)
    const oldest = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    const pedidosUlt12 = await Pedido.find({ fechaPedido: { $gte: oldest, $lte: now } }).lean();

    pedidosUlt12.forEach(p => {
      const d = new Date(p.fechaPedido || p.createdAt || p.updatedAt);
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      if (revenuesMap.hasOwnProperty(key)) {
        revenuesMap[key] += Number(p.total) || 0;
      }
    });

    const months = monthsArr.map(m => m.label); // etiquetas cortas para la UI
    const revenuesByMonth = monthsArr.map(m => Number((revenuesMap[m.key] || 0).toFixed(2)));

    // Finalmente renderizamos la vista con todas las variables
    res.render('dashboard', {
      usuario: req.user || {},
      platosDisponibles,
      pedidosHoy,
      totalPedidos,
      ventasTotales,
      gananciaTotal,
      pedidosRecientes,
      months,
      revenuesByMonth,
      totalEmpleados,
      empleadosLinea
    });

  } catch (error) {
    console.error('Error al cargar el dashboard:', error);
    res.status(500).send('Error al cargar el dashboard');
  }
});


// --- Dashboards por rol (mantener como antes) ---
router.get('/dashboard_mesero', verifyToken, async (req, res) => {
  try {
    const users = await Usuario.find().lean();
    res.render('dashboard_mesero', {
      usuario: req.user, // datos del usuario logueado
      users,             // lista de usuarios para el bucle EJS
    });
  } catch (error) {
    console.error('Error al cargar dashboard del mesero:', error);
    res.render('dashboard_mesero', {
      usuario: req.user,
      users: [],
      error: 'Error al cargar los usuarios',
    });
  }
});

router.get('/dashboard_cajero', verifyToken, async (req, res) => {
  try {
    const users = await Usuario.find().lean();
    res.render('dashboard_cajero', {
      usuario: req.user || {},
      users,
      error: null
    });
  } catch (error) {
    res.render('dashboard_cajero', {
      usuario: req.user || {},
      users: [],
      error: 'Error al cargar usuarios'
    });
  }
});

router.get('/dashboard_cocinero', verifyToken, async (req, res) => {
  try {
    const users = await Usuario.find().lean();
    res.render('dashboard_cocinero', {
      usuario: req.user || {},
      users,
      error: null
    });
  } catch (error) {
    res.render('dashboard_cocinero', {
      usuario: req.user || {},
      users: [],
      error: 'Error al cargar usuarios'
    });
  }
});

router.get('/logout', (req, res) => {
  res.clearCookie('token'); // elimina la cookie con el JWT
  res.redirect('/login');   // redirige al login
});

module.exports = router;