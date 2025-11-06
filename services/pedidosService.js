// services/pedidosService.js
const Pedido = require('../models/pedidosModel');
const Mesa = require('../models/mesasModel');
const Platos = require('../models/platosModel');
const Venta = require('../models/ventaModel');
const Usuario = require('../models/userModel');

class PedidosService {

// ✅ RF010 - Crear nuevo pedido
  async crearPedido(data) {
    const { mesaId, platos, meseroId, observacionesGenerales } = data;

    // CAMBIO: Validar que el mesero existe usando userModel
    const mesero = await Usuario.findById(meseroId);
    if (!mesero) {
      throw new Error('Mesero no encontrado');
    }

    // Validar que la mesa existe
    const mesa = await Mesa.findById(mesaId);
    if (!mesa) {
      throw new Error('Mesa no encontrada');
    }

    // CAMBIO: Validar que la mesa esté disponible o liberada
    if (!['disponible', 'liberada'].includes(mesa.estado)) {
      throw new Error('La mesa no está disponible para nuevos pedidos');
    }

    // Validar y preparar los platos
    const platosDetallados = [];
    let total = 0;

    for (const item of platos) {
      const plato = await Platos.findById(item.platoId);
      if (!plato) {
        throw new Error(`Plato ${item.platoId} no encontrado`);
      }

      // CAMBIO: Validar stock y disponibilidad
      if (plato.stock < item.cantidad || !plato.disponible) {
        throw new Error(`Stock insuficiente o plato no disponible: ${plato.nombre}`);
      }

      const subtotal = plato.precio * item.cantidad;
      total += subtotal;

      platosDetallados.push({
        plato: plato._id,
        nombre: plato.nombre,
        precio: plato.precio,
        cantidad: item.cantidad,
        observaciones: item.observaciones || '',
        subtotal: subtotal,
        estado: 'pendiente' // CAMBIO: Agregar estado individual del plato
      });

      // Reducir stock del plato
      plato.stock -= item.cantidad;
      if (plato.stock <= 0) {
        plato.disponible = false;
      }
      await plato.save();
    }

    // Crear el pedido
    const nuevoPedido = new Pedido({
      mesa: mesaId,
      platos: platosDetallados,
      total: total,
      mesero: meseroId,
      observacionesGenerales: observacionesGenerales || '',
      estadoPedido: 'pendiente',
      estadoPago: 'pendiente'
    });

    await nuevoPedido.save();

    // CAMBIO: Actualizar estado de la mesa según el modelo actualizado
    mesa.estado = 'ocupada';
    mesa.pedidoActual = nuevoPedido._id;
    mesa.historialPedidos.push({
      pedido: nuevoPedido._id,
      fecha: new Date()
    });
    await mesa.save();

    // Populate para respuesta
    const pedidoPopulado = await Pedido.findById(nuevoPedido._id)
      .populate('mesa', 'numeroMesa piso sector')
      .populate('mesero', 'nombre email');

    return pedidoPopulado;
  }

  // ✅ RF012 - Agregar platos a pedido existente
  async agregarPlatos(pedidoId, platosData) {
    const pedido = await Pedido.findById(pedidoId);
    if (!pedido) {
      throw new Error('Pedido no encontrado');
    }

    // CAMBIO: Validar que el pedido no esté pagado
    if (pedido.estadoPago === 'pagado') {
      throw new Error('No se puede modificar un pedido ya pagado');
    }

    let totalAdicional = 0;
    const nuevosPlatos = [];

    for (const item of platosData) {
      const plato = await Platos.findById(item.platoId);
      if (!plato) {
        throw new Error(`Plato ${item.platoId} no encontrado`);
      }

      // CAMBIO: Validar stock y disponibilidad
      if (plato.stock < item.cantidad || !plato.disponible) {
        throw new Error(`Stock insuficiente o plato no disponible: ${plato.nombre}`);
      }

      const subtotal = plato.precio * item.cantidad;
      totalAdicional += subtotal;

      nuevosPlatos.push({
        plato: plato._id,
        nombre: plato.nombre,
        precio: plato.precio,
        cantidad: item.cantidad,
        observaciones: item.observaciones || '',
        subtotal: subtotal,
        estado: 'pendiente'
      });

      // Reducir stock
      plato.stock -= item.cantidad;
      if (plato.stock <= 0) {
        plato.disponible = false;
      }
      await plato.save();
    }

    // Agregar nuevos platos al pedido
    pedido.platos.push(...nuevosPlatos);
    pedido.total += totalAdicional;
    
    await pedido.save();

    const pedidoActualizado = await Pedido.findById(pedidoId)
      .populate('mesa', 'numeroMesa piso sector')
      .populate('mesero', 'nombre email')
      .populate('platos.plato', 'nombre precio imagen');

    return pedidoActualizado;
  }

  // ✅ RF014 - Consultar estado de pedidos
  async listarPedidos(filtros = {}) {
    const { estadoPedido, estadoPago, mesa } = filtros;
    const filtro = { activo: true }; // CAMBIO: Solo pedidos activos

    if (estadoPedido) filtro.estadoPedido = estadoPedido;
    if (estadoPago) filtro.estadoPago = estadoPago;
    if (mesa) filtro.mesa = mesa;

    const pedidos = await Pedido.find(filtro)
      .populate('mesa', 'numeroMesa piso sector estado')
      .populate('mesero', 'nombre email')
      .populate('platos.plato', 'nombre precio imagen')
      .sort({ fechaPedido: -1 });

    return pedidos;
  }

  // NUEVO: Obtener pedidos por mesa específica
  async obtenerPedidosPorMesa(mesaId) {
    const pedidos = await Pedido.find({ 
      mesa: mesaId,
      activo: true 
    })
    .populate('mesero', 'nombre')
    .populate('platos.plato', 'nombre precio')
    .sort({ fechaPedido: -1 });

    return pedidos;
  }

  // Resto de métodos se mantienen igual...
  async obtenerPedido(pedidoId) {
    const pedido = await Pedido.findById(pedidoId)
      .populate('mesa', 'numeroMesa piso sector estado')
      .populate('mesero', 'nombre email')
      .populate('platos.plato', 'nombre precio imagen descripcion');

    if (!pedido) {
      throw new Error('Pedido no encontrado');
    }

    return pedido;
  }

  async cambiarEstadoPedido(pedidoId, estadoPedido) {
    const pedido = await Pedido.findById(pedidoId);
    if (!pedido) {
      throw new Error('Pedido no encontrado');
    }

    pedido.estadoPedido = estadoPedido;
    await pedido.save();

    return pedido;
  }
  
  // ✅ Pagar pedido
  async pagarPedido(pedidoId, datosPago = {}) {
    const { metodoPago, montoPagado } = datosPago;

    const pedido = await Pedido.findById(pedidoId);
    if (!pedido) {
      throw new Error('Pedido no encontrado');
    }

    if (pedido.estadoPago === 'pagado') {
      throw new Error('El pedido ya está pagado');
    }

    // Registrar pago
    pedido.estadoPago = 'pagado';
    pedido.fechaPago = new Date();
    pedido.historialPagos.push({
      monto: montoPagado || pedido.total,
      fecha: new Date(),
      metodo: metodoPago || 'efectivo'
    });

    await pedido.save();

    // Liberar mesa
    const mesa = await Mesa.findById(pedido.mesa);
    if (mesa) {
      mesa.estado = 'liberada';
      mesa.pedidoActual = null;
      await mesa.save();
    }

    // Crear registro de venta
    const venta = new Venta({
      mesa: pedido.mesa,
      pedido: pedido._id,
      platos: pedido.platos,
      subtotal: pedido.total,
      total: pedido.total * 1.18, // con IGV
      metodoPago: metodoPago || 'efectivo',
      mesero: pedido.mesero
    });
    await venta.save();

    const pedidoActualizado = await Pedido.findById(pedidoId)
      .populate('mesa', 'numeroMesa piso sector')
      .populate('mesero', 'nombre email')
      .populate('platos.plato', 'nombre precio imagen');

    return {
      pedido: pedidoActualizado,
      venta: venta
    };
  }

  // ✅ Cancelar pedido
  async cancelarPedido(pedidoId) {
    const pedido = await Pedido.findById(pedidoId);
    if (!pedido) {
      throw new Error('Pedido no encontrado');
    }

    // Devolver stock de los platos
    for (const item of pedido.platos) {
      const plato = await Platos.findById(item.plato);
      if (plato) {
        plato.stock += item.cantidad;
        await plato.save();
      }
    }

    // Liberar mesa
    const mesa = await Mesa.findById(pedido.mesa);
    if (mesa) {
      mesa.estado = 'disponible';
      mesa.pedidoActual = null;
      await mesa.save();
    }

    // Marcar pedido como cancelado
    pedido.estadoPedido = 'cancelado';
    pedido.activo = false;
    await pedido.save();

    return pedido;
  }

  // ✅ Obtener pedidos pendientes de pago
  async obtenerPedidosPendientesPago() {
    const pedidos = await Pedido.find({ 
      estadoPago: 'pendiente',
      activo: true 
    })
    .populate('mesa', 'numeroMesa piso sector')
    .populate('mesero', 'nombre')
    .populate('platos.plato', 'nombre precio imagen')
    .sort({ fechaPedido: 1 });

    return pedidos;
  }

  // ✅ Registrar pago parcial
  async pagoParcial(pedidoId, pagoData) {
    const { monto, metodoPago } = pagoData;

    const pedido = await Pedido.findById(pedidoId);
    if (!pedido) {
      throw new Error('Pedido no encontrado');
    }

    // Registrar pago parcial
    pedido.estadoPago = 'parcial';
    pedido.historialPagos.push({
      monto: monto,
      fecha: new Date(),
      metodo: metodoPago
    });

    // Verificar si el total ya está cubierto
    const totalPagado = pedido.historialPagos.reduce((sum, pago) => sum + pago.monto, 0);
    if (totalPagado >= pedido.total) {
      pedido.estadoPago = 'pagado';
      pedido.fechaPago = new Date();

      // Liberar mesa si está completamente pagado
      const mesa = await Mesa.findById(pedido.mesa);
      if (mesa) {
        mesa.estado = 'liberada';
        mesa.pedidoActual = null;
        await mesa.save();
      }
    }

    await pedido.save();

    return {
      pedido: pedido,
      totalPagado: totalPagado,
      pendiente: pedido.total - totalPagado
    };
  }

  // ✅ Obtener historial de pagos
  async obtenerHistorialPagos(pedidoId) {
    const pedido = await Pedido.findById(pedidoId)
      .select('historialPagos total estadoPago');
    
    if (!pedido) {
      throw new Error('Pedido no encontrado');
    }

    const totalPagado = pedido.historialPagos.reduce((sum, pago) => sum + pago.monto, 0);
    const pendiente = pedido.total - totalPagado;

    return {
      historial: pedido.historialPagos,
      total: pedido.total,
      totalPagado: totalPagado,
      pendiente: pendiente,
      estadoPago: pedido.estadoPago
    };
  }

  // ✅ Obtener pedidos por mesa
  async obtenerPedidosPorMesa(mesaId) {
    const pedidos = await Pedido.find({ 
      mesa: mesaId,
      activo: true 
    })
    .populate('mesero', 'nombre')
    .populate('platos.plato', 'nombre precio')
    .sort({ fechaPedido: -1 });

    return pedidos;
  }

  // ✅ Obtener estadísticas de pedidos
  async obtenerEstadisticas() {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const manana = new Date(hoy);
    manana.setDate(manana.getDate() + 1);

    const pedidosHoy = await Pedido.countDocuments({
      fechaPedido: { $gte: hoy, $lt: manana },
      activo: true
    });

    const pedidosPendientes = await Pedido.countDocuments({
      estadoPago: 'pendiente',
      activo: true
    });

    const totalVentasHoy = await Pedido.aggregate([
      {
        $match: {
          fechaPedido: { $gte: hoy, $lt: manana },
          estadoPago: 'pagado',
          activo: true
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$total' }
        }
      }
    ]);

    const pedidosPorEstado = await Pedido.aggregate([
      {
        $match: { activo: true }
      },
      {
        $group: {
          _id: '$estadoPedido',
          count: { $sum: 1 }
        }
      }
    ]);

    return {
      pedidosHoy: pedidosHoy,
      pedidosPendientes: pedidosPendientes,
      totalVentasHoy: totalVentasHoy[0]?.total || 0,
      pedidosPorEstado: pedidosPorEstado
    };
  }
}

module.exports = PedidosService;