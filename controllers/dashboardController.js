// controllers/dashboardController.js
const Pedido = require('../models/pedidosModel');
const Usuario = require('../models/userModel');
const Plato = require('../models/platosModel');


function getLast12MonthsLabels() {
  const labels = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    labels.push(d.toLocaleString('es-ES', { month: 'short' }).replace('.', '')); // Ene, Feb, ...
  }
  return labels;
}

exports.dashboard = async (req, res) => {
  try {
    // usuario logueado (desde middleware)
    const usuario = req.user || {};

    // total de pedidos (activos)
    const totalPedidos = await Pedido.countDocuments({ activo: true });

    // pedidos del día (filtrado por fechaPedido entre inicio y fin del día)
    const inicioHoy = new Date();
    inicioHoy.setHours(0, 0, 0, 0);
    const finHoy = new Date();
    finHoy.setHours(23, 59, 59, 999);
    const pedidosHoy = await Pedido.countDocuments({
      fechaPedido: { $gte: inicioHoy, $lt: finHoy },
      activo: true
    });

    // platos disponibles (estado activo y stock > 0)
    const platosDisponibles = await Plato.countDocuments({ estado: 'activo', stock: { $gt: 0 } });

    // ventas totales: sumar total de pedidos con estadoPago = 'pagado'
    const ventasAgg = await Pedido.aggregate([
      { $match: { estadoPago: 'pagado', activo: true } },
      { $group: { _id: null, totalVentas: { $sum: "$total" } } }
    ]);
    const ventasTotales = (ventasAgg[0] && ventasAgg[0].totalVentas) ? ventasAgg[0].totalVentas : 0;

    // Ganancia estimada: no tenemos costo real, así que dejamos un estimado (ej. 30%).
    const MARGEN_ESTIMADO = 0.3;
    const gananciaTotal = ventasTotales * MARGEN_ESTIMADO;

    // Total empleados (excluyendo admin)
    const totalEmpleados = await Usuario.countDocuments({ rol: { $ne: 'admin' } });

    // Empleados en línea -> valor simulado (puedes mejorar con sesión)
    const empleadosLinea = 0;


    // Pedidos recientes (últimos 5 pedidos activos)
    const pedidosRecientes = await Pedido.find({ activo: true })
      .populate('mesa', 'numeroMesa')
      .populate('mesero', 'nombre')
      .populate('platos.plato', 'nombre')
      .sort({ fechaPedido: -1 })
      .limit(5)
      .lean();

    // Ingresos por mes (últimos 12 meses): agregación
    const now = new Date();
    const primerDiaHace12 = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    const agg = await Pedido.aggregate([
      { $match: { estadoPago: 'pagado', activo: true, fechaPedido: { $gte: primerDiaHace12 } } },
      {
        $group: {
          _id: { year: { $year: "$fechaPedido" }, month: { $month: "$fechaPedido" } },
          total: { $sum: "$total" }
        }
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } }
    ]);

    // Construir arrays mes a mes para los últimos 12 meses (en orden ascendente)
    const months = getLast12MonthsLabels(); // etiquetas cortas en español para la vista
    // Inicializar arreglo con ceros
    const revenuesByMonth = new Array(12).fill(0);

    // Mapear resultados del agg a nuestro arreglo
    // Crear un map clave 'YYYY-MM' -> total
    const mapAgg = {};
    agg.forEach(item => {
      const y = item._id.year;
      const m = item._id.month; // 1..12
      const key = `${y}-${String(m).padStart(2, '0')}`;
      mapAgg[key] = item.total;
    });

    // Rellenar revenuesByMonth de acuerdo a los últimos 12 meses
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const monthIndex = 11 - i; // 0..11 (antiguo -> reciente)
      revenuesByMonth[monthIndex] = mapAgg[key] || 0;
    }

    // Render con todas las variables que usa tu vista
    res.render('dashboard', {
    usuario,
    totalPedidos,
    pedidosHoy,
    platosDisponibles,
    ventasTotales,
    gananciaTotal,
    totalEmpleados,
    empleadosLinea,
    pedidosRecientes,
    months,
    revenuesByMonth
    });


  } catch (error) {
    console.error('Error en dashboard:', error);
    res.status(500).send('Error al cargar el dashboard');
  }
};


// Dashboard del mesero (mantener simple)
exports.dashboardMesero = async (req, res) => {
  try {
    const users = await Usuario.find();
    res.render('dashboard_mesero', { usuario: req.user, users });
  } catch (error) {
    console.error('Error al cargar dashboard mesero:', error);
    res.render('dashboard_mesero', { usuario: req.user, users: [], error: 'Error al cargar usuarios' });
  }
};

// Dashboard del cajero
exports.dashboardCajero = async (req, res) => {
  try {
    const users = await Usuario.find();
    res.render('dashboard_cajero', { usuario: req.user, users });
  } catch (error) {
    console.error('Error al cargar dashboard cajero:', error);
    res.render('dashboard_cajero', { usuario: req.user, users: [], error: 'Error al cargar usuarios' });
  }
};

// Dashboard del cocinero (solo pedidos pagados)
exports.dashboardCocinero = async (req, res) => {
  try {
    // Mostrar pedidos con estadoPago = 'pagado' (minúscula)
    const pedidosPagados = await Pedido.find({ estadoPago: 'pagado', activo: true })
      .populate('mesa', 'numeroMesa')
      .populate('mesero', 'nombre email')
      .populate('platos.plato', 'nombre precio')
      .sort({ fechaPedido: -1 });

    res.render('dashboard_cocinero', {
      usuario: req.user || {},
      pedidos: pedidosPagados,
      error: null
    });
  } catch (error) {
    console.error('Error al cargar dashboard cocinero:', error);
    res.render('dashboard_cocinero', {
      usuario: req.user || {},
      pedidos: [],
      error: 'Error al cargar los pedidos'
    });
  }
};
