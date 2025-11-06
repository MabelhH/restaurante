// controllers/pedidosController.js
const Pedido = require('../models/pedidosModel');
const Mesa = require('../models/mesasModel');
const Platos = require('../models/platosModel');
const Usuario = require('../models/userModel'); 

class PedidosController {
  
  // ✅ RF010 - Crear nuevo pedido
  async crearPedido(req, res) {
    try {
      const { mesaId, platos, meseroId, observacionesGenerales } = req.body;

      console.log('Datos recibidos:', { mesaId, platos, meseroId, observacionesGenerales });

      // CAMBIO: Validar que el mesero existe usando userModel
      const mesero = await Usuario.findById(meseroId);
      if (!mesero) {
        return res.status(404).json({ error: 'Mesero no encontrado' });
      }

      // Validar que la mesa exista
      const mesa = await Mesa.findById(mesaId);
      if (!mesa) {
        return res.status(404).json({ error: 'Mesa no encontrada' });
      }

      // CAMBIO: Validar que la mesa esté disponible o liberada
      if (!['disponible', 'liberada'].includes(mesa.estado)) {
        return res.status(400).json({ error: 'La mesa no está disponible para nuevos pedidos' });
      }

      // Validar que hay platos
      if (!platos || platos.length === 0) {
        return res.status(400).json({ error: 'El pedido debe contener al menos un plato' });
      }

      // Validar y preparar los platos
      const platosDetallados = [];
      let total = 0;

      for (const item of platos) {
        const plato = await Platos.findById(item.platoId);
        if (!plato) {
          return res.status(404).json({ error: `Plato ${item.platoId} no encontrado` });
        }

        // CAMBIO: Validar stock y disponibilidad
        if (plato.stock < item.cantidad) {
          return res.status(400).json({ 
            error: `Stock insuficiente para ${plato.nombre}. Stock disponible: ${plato.stock}` 
          });
        }

        if (!plato.disponible || plato.estado !== 'activo') {
          return res.status(400).json({ 
            error: `El plato ${plato.nombre} no está disponible` 
          });
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
          estado: 'pendiente'
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

      // CAMBIO: Actualizar estado de la mesa
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

      res.status(201).json({
        mensaje: 'Pedido creado exitosamente',
        pedido: pedidoPopulado
      });

    } catch (error) {
      console.error('Error al crear pedido:', error);
      res.status(500).json({ error: error.message });
    }
  }

  // ✅ RF012 - Agregar platos a pedido existente
  async agregarPlatos(req, res) {
    try {
      const { pedidoId } = req.params;
      const { platos } = req.body;

      const pedido = await Pedido.findById(pedidoId);
      if (!pedido) {
        return res.status(404).json({ error: 'Pedido no encontrado' });
      }

      // CAMBIO: Validar que el pedido no esté pagado
      if (pedido.estadoPago === 'pagado') {
        return res.status(400).json({ error: 'No se puede modificar un pedido ya pagado' });
      }

      let totalAdicional = 0;
      const nuevosPlatos = [];

      for (const item of platos) {
        const plato = await Platos.findById(item.platoId);
        if (!plato) {
          return res.status(404).json({ error: `Plato ${item.platoId} no encontrado` });
        }

        // CAMBIO: Validar stock y disponibilidad
        if (plato.stock < item.cantidad) {
          return res.status(400).json({ 
            error: `Stock insuficiente para ${plato.nombre}` 
          });
        }

        if (!plato.disponible || plato.estado !== 'activo') {
          return res.status(400).json({ 
            error: `El plato ${plato.nombre} no está disponible` 
          });
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

      res.json({
        mensaje: 'Platos agregados exitosamente',
        pedido: pedidoActualizado
      });

    } catch (error) {
      console.error('Error al agregar platos:', error);
      res.status(500).json({ error: error.message });
    }
  }

  // ✅ RF014 - Consultar estado de pedidos
  async listarPedidos(req, res) {
    try {
      const { estadoPedido, estadoPago, mesa } = req.query;
      const filtro = { activo: true }; // CAMBIO: Solo pedidos activos

      if (estadoPedido) filtro.estadoPedido = estadoPedido;
      if (estadoPago) filtro.estadoPago = estadoPago;
      if (mesa) filtro.mesa = mesa;

      const pedidos = await Pedido.find(filtro)
        .populate('mesa', 'numeroMesa piso sector estado')
        .populate('mesero', 'nombre email')
        .populate('platos.plato', 'nombre precio imagen')
        .sort({ fechaPedido: -1 });

      res.json(pedidos);
    } catch (error) {
      console.error('Error al listar pedidos:', error);
      res.status(500).json({ error: error.message });
    }
  }

  // Resto de métodos se mantienen igual con pequeñas mejoras...
  async cambiarEstadoPedido(req, res) {
    try {
      const { pedidoId } = req.params;
      const { estadoPedido } = req.body;

      const pedido = await Pedido.findById(pedidoId);
      if (!pedido) {
        return res.status(404).json({ error: 'Pedido no encontrado' });
      }

      pedido.estadoPedido = estadoPedido;
      await pedido.save();

      res.json({
        mensaje: `Estado del pedido actualizado a: ${estadoPedido}`,
        pedido: pedido
      });

    } catch (error) {
      console.error('Error al cambiar estado:', error);
      res.status(500).json({ error: error.message });
    }
  }

  // ✅ RF011 - Generar ticket de pago (marcar como pagado)
  async pagarPedido(req, res) {
    try {
      const { pedidoId } = req.params;
      const { metodoPago, montoPagado } = req.body;

      const pedido = await Pedido.findById(pedidoId);
      if (!pedido) {
        return res.status(404).json({ error: 'Pedido no encontrado' });
      }

      if (pedido.estadoPago === 'pagado') {
        return res.status(400).json({ error: 'El pedido ya está pagado' });
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

      // ✅ RF013 - Liberar mesa
      const mesa = await Mesa.findById(pedido.mesa);
      if (mesa) {
        mesa.estado = 'liberada';
        mesa.pedidoActual = null;
        await mesa.save();
      }

      // Crear registro de venta (opcional, para historial)
      const Venta = require('../models/ventaModel');
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

      res.json({
        mensaje: 'Pedido pagado exitosamente',
        pedido: pedidoActualizado,
        venta: venta
      });

    } catch (error) {
      console.error('Error al pagar pedido:', error);
      res.status(500).json({ error: error.message });
    }
  }

  // ✅ Obtener pedido específico
  async obtenerPedido(req, res) {
    try {
      const { pedidoId } = req.params;

      const pedido = await Pedido.findById(pedidoId)
        .populate('mesa', 'numeroMesa piso sector estado')
        .populate('mesero', 'nombre email')
        .populate('platos.plato', 'nombre precio imagen descripcion');

      if (!pedido) {
        return res.status(404).json({ error: 'Pedido no encontrado' });
      }

      res.json(pedido);
    } catch (error) {
      console.error('Error al obtener pedido:', error);
      res.status(500).json({ error: error.message });
    }
  }

  // ✅ Cancelar pedido
  async cancelarPedido(req, res) {
    try {
      const { pedidoId } = req.params;

      const pedido = await Pedido.findById(pedidoId);
      if (!pedido) {
        return res.status(404).json({ error: 'Pedido no encontrado' });
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

      res.json({
        mensaje: 'Pedido cancelado exitosamente',
        pedido: pedido
      });

    } catch (error) {
      console.error('Error al cancelar pedido:', error);
      res.status(500).json({ error: error.message });
    }
  }

  // ✅ Obtener pedidos por mesa
  async obtenerPedidosPorMesa(req, res) {
    try {
      const { mesaId } = req.params;

      const pedidos = await Pedido.find({ 
        mesa: mesaId,
        activo: true 
      })
      .populate('mesero', 'nombre')
      .populate('platos.plato', 'nombre precio')
      .sort({ fechaPedido: -1 });

      res.json(pedidos);
    } catch (error) {
      console.error('Error al obtener pedidos por mesa:', error);
      res.status(500).json({ error: error.message });
    }
  }

  // ✅ Obtener pedidos pendientes de pago
  async obtenerPedidosPendientesPago(req, res) {
    try {
      const pedidos = await Pedido.find({ 
        estadoPago: 'pendiente',
        activo: true 
      })
      .populate('mesa', 'numeroMesa piso sector')
      .populate('mesero', 'nombre')
      .populate('platos.plato', 'nombre precio imagen')
      .sort({ fechaPedido: 1 });

      res.json(pedidos);
    } catch (error) {
      console.error('Error al obtener pedidos pendientes:', error);
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = new PedidosController();