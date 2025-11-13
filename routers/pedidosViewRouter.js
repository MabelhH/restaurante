//pedidosViewRouter.js
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

// Ruta principal de pedidos (según rol) - MODIFICADA PARA SOLO PEDIDOS DEL DÍA
router.get('/', verifyToken, async (req, res) => {
  try {
    let filtroPedidos = { activo: true };
    
    // Si es mesero, solo ver sus pedidos
    if (req.user.rol === 'mesero') {
      filtroPedidos.mesero = req.user._id;
      console.log(`🔍 Pedidos filtrados para mesero: ${req.user._id}`);
    }

    // ✅ Si es cocinero, solo mostrar pedidos pagados
    if (req.user.rol === 'cocinero') {
      filtroPedidos.estadoPago = 'pagado';
    }

    // ✅ FILTRAR SOLO POR FECHA ACTUAL - CORREGIDO
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const manana = new Date(hoy);
    manana.setDate(manana.getDate() + 1);
    
    filtroPedidos.fechaPedido = { 
      $gte: hoy, 
      $lt: manana 
    };

    const pedidos = await Pedido.find(filtroPedidos)
      .populate('mesa', 'numeroMesa piso sector estado')
      .populate('mesero', 'nombre')
      .populate('platos.plato', 'nombre precio imagen')
      .sort({ fechaPedido: -1 });

    const mesas = await Mesa.find({ estado: { $in: ['disponible', 'ocupada'] } });
    const platos = await Platos.find({ estado: 'activo', stock: { $gt: 0 } });

    const userData = {
      _id: req.user._id,
      nombre: req.user.nombre,
      email: req.user.email,
      rol: req.user.rol
    };

    console.log('📋 Cargando pedidos DEL DÍA para:', {
      usuario: userData.nombre,
      rol: userData.rol,
      totalPedidos: pedidos.length,
      fecha: hoy.toLocaleDateString()
    });

    if (req.user.rol === 'admin') {
      res.render('pedidos', { 
        usuario: userData, 
        pedidos, 
        mesas, 
        platos,
        pedidoActual: null
      });
    } else if (req.user.rol === 'mesero') {
      res.render('pedidosM', { 
        usuario: userData, 
        pedidos, 
        mesas, 
        platos,
        pedidoActual: null
      });
    } else if (req.user.rol === 'cocinero') {
      res.render('pedidosc', { 
        usuario: userData, 
        pedidos, 
        mesas, 
        platos,
        pedidoActual: null
      });
    } else {
      res.status(403).send('Acceso denegado');
    }
  } catch (error) {
    console.error('Error al cargar pedidos:', error);
    res.status(500).render('error', { 
      mensaje: 'Error al cargar los pedidos',
      usuario: req.user 
    });
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
      .populate('mesa', 'numeroMesa piso sector estado')
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
        pedidoActual: null
      });
    }
  } catch (error) {
    console.error('❌ Error al cargar vista de pedidos:', error);
    res.status(500).render('error', { 
      mensaje: 'Error al cargar los pedidos',
      usuario: req.user 
    });
  }
});

// Ruta para crear nuevo pedido (vista de formulario)
router.get('/nuevo', verifyToken, async (req, res) => {
  try {
    const mesas = await Mesa.find({ 
      estado: { $in: ['disponible', 'liberada'] } 
    });
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
    res.status(500).render('error', { 
      mensaje: 'Error al cargar el formulario',
      usuario: req.user 
    });
  }
});

// Ruta para ver detalle de pedido específico
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const pedido = await Pedido.findById(req.params.id)
      .populate('mesa', 'numeroMesa piso sector estado')
      .populate('mesero', 'nombre email')
      .populate('platos.plato', 'nombre precio imagen descripcion');

    if (!pedido) {
      return res.status(404).render('error', { 
        mensaje: 'Pedido no encontrado',
        usuario: req.user 
      });
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
    res.status(500).render('error', { 
      mensaje: 'Error al cargar el pedido',
      usuario: req.user 
    });
  }
});

// Ruta para editar pedido (vista de edición)
router.get('/:id/editar', verifyToken, async (req, res) => {
  try {
    const pedido = await Pedido.findById(req.params.id)
      .populate('mesa', 'numeroMesa piso sector estado')
      .populate('mesero', 'nombre email')
      .populate('platos.plato', 'nombre precio imagen descripcion stock');

    if (!pedido) {
      return res.status(404).render('error', { 
        mensaje: 'Pedido no encontrado',
        usuario: req.user 
      });
    }

    // Verificar que el pedido pertenece al mesero o es admin
    if (req.user.rol === 'mesero' && pedido.mesero._id.toString() !== req.user._id) {
      return res.status(403).render('error', { 
        mensaje: 'No tienes permisos para editar este pedido',
        usuario: req.user 
      });
    }

    // Solo se puede editar si el pedido está pendiente y no pagado
    if (pedido.estadoPedido !== 'pendiente' || pedido.estadoPago !== 'pendiente') {
      return res.status(400).render('error', { 
        mensaje: 'Solo se pueden editar pedidos pendientes de pago',
        usuario: req.user 
      });
    }

    const platos = await Platos.find({ estado: 'activo', stock: { $gt: 0 } });
    const userData = {
      _id: req.user._id,
      nombre: req.user.nombre,
      email: req.user.email,
      rol: req.user.rol
    };

    if (req.user.rol === 'admin') {
      res.render('editarPedido', { 
        usuario: userData, 
        pedido,
        platos
      });
    } else if (req.user.rol === 'mesero') {
      res.render('editarPedidoM', {
        usuario: userData,
        pedido,
        platos
      });
    } else {
      res.status(403).send('Acceso denegado');
    }
  } catch (error) {
    console.error('Error al cargar pedido para editar:', error);
    res.status(500).render('error', { 
      mensaje: 'Error al cargar el pedido para editar',
      usuario: req.user 
    });
  }
});
// ✅ NUEVA RUTA: Obtener platos listos del día actual
router.get('/platos-listos', verifyToken, async (req, res) => {
  try {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const manana = new Date(hoy);
    manana.setDate(manana.getDate() + 1);

    // Buscar pedidos del día actual que tengan platos listos
    const pedidos = await Pedido.find({
      fechaPedido: { $gte: hoy, $lt: manana },
      activo: true,
      'platos.estado': 'listo' // Solo pedidos que tengan al menos un plato listo
    })
    .populate('mesa', 'numeroMesa')
    .populate('mesero', 'nombre')
    .sort({ fechaPedido: -1 });

    // Recopilar todos los platos listos de todos los pedidos
    let platosListos = [];
    
    pedidos.forEach(pedido => {
      pedido.platos.forEach((plato, platoIndex) => {
        if (plato.estado === 'listo') {
          platosListos.push({
            pedidoId: pedido._id,
            platoIndex: platoIndex,
            mesa: pedido.mesa?.numeroMesa || 'Sin mesa',
            nombrePlato: plato.nombre,
            cantidad: plato.cantidad,
            numeroPedido: pedido.numeroPedido || pedido._id.toString().slice(-4),
            fechaActualizacion: pedido.updatedAt, // Usamos la fecha de actualización del pedido
            mesero: pedido.mesero?.nombre || 'Sin mesero'
          });
        }
      });
    });

    // Ordenar por fecha de actualización (más recientes primero)
    platosListos.sort((a, b) => new Date(b.fechaActualizacion) - new Date(a.fechaActualizacion));

    console.log(`🔔 Se encontraron ${platosListos.length} platos listos`);

    res.json(platosListos);

  } catch (error) {
    console.error('Error al obtener platos listos:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ✅ Ruta para pedidos históricos - CORREGIDA PARA FILTRADO EXACTO
router.get('/historial/todos', verifyToken, async (req, res) => {
  try {
    let filtroPedidos = { activo: true };
    
    // Filtrar por mesero si no es admin
    if (req.user.rol === 'mesero') {
      filtroPedidos.mesero = req.user._id;
      console.log(`🔍 Historial filtrado para mesero: ${req.user._id}`);
    }

    const { fecha } = req.query;
    
    if (fecha) {
      // CORRECCIÓN: Crear el rango exacto para la fecha seleccionada
      // Considerando la zona horaria de Perú (UTC-5)
      const fechaSeleccionada = new Date(fecha);
      
      // Ajustar para zona horaria de Perú (UTC-5)
      // Inicio del día en Perú: 00:00:00 UTC-5 = 05:00:00 UTC
      const fechaInicio = new Date(fechaSeleccionada);
      fechaInicio.setUTCHours(5, 0, 0, 0); // 00:00 hora Perú = 05:00 UTC
      
      // Fin del día en Perú: 23:59:59 UTC-5 = 04:59:59 UTC del día siguiente
      const fechaFin = new Date(fechaSeleccionada);
      fechaFin.setUTCHours(28, 59, 59, 999); // 23:59 hora Perú = 04:59 UTC del día siguiente
      
      console.log(`📅 Filtro de fechas - Seleccionada: ${fecha}`);
      console.log(`📅 Rango UTC - Inicio: ${fechaInicio.toISOString()}`);
      console.log(`📅 Rango UTC - Fin: ${fechaFin.toISOString()}`);
      
      filtroPedidos.fechaPedido = { 
        $gte: fechaInicio, 
        $lte: fechaFin
      };
    } else {
      // Si no hay fecha, mostrar solo los pedidos de hoy
      const hoy = new Date();
      hoy.setUTCHours(5, 0, 0, 0); // Inicio del día en Perú
      
      const manana = new Date(hoy);
      manana.setUTCHours(29, 59, 59, 999); // Fin del día en Perú
      
      filtroPedidos.fechaPedido = { 
        $gte: hoy, 
        $lte: manana
      };
      
      console.log('📅 Mostrando pedidos de hoy (sin filtro)');
    }

    const pedidos = await Pedido.find(filtroPedidos)
      .populate('mesa', 'numeroMesa piso sector')
      .populate('mesero', 'nombre')
      .populate('platos.plato', 'nombre precio')
      .sort({ fechaPedido: -1 });

    const userData = {
      _id: req.user._id,
      nombre: req.user.nombre,
      email: req.user.email,
      rol: req.user.rol
    };

    console.log(`📊 Historial cargado: ${pedidos.length} pedidos para ${userData.nombre}`);

    res.render('historialPedidos', {
      usuario: userData,
      pedidos,
      fechaSeleccionada: fecha || ''
    });

  } catch (error) {
    console.error('❌ Error al cargar historial de pedidos:', error);
    res.status(500).render('error', { 
      mensaje: 'Error al cargar el historial',
      usuario: req.user 
    });
  }
});

module.exports = router;