// controllers/pedidosController.js
const Pedido = require('../models/pedidosModel');
const Mesa = require('../models/mesasModel');
const Platos = require('../models/platosModel');
const Usuario = require('../models/userModel');
const mongoose = require('mongoose');

class PedidosController {

  // ✅ RF010 - Crear nuevo pedido
  async crearPedido(req, res) {
    try {
      const { mesaId, platos, meseroId, observacionesGenerales } = req.body;

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

      console.log('🔍 DEBUG - Estado de la mesa:', {
        mesaId: mesa._id,
        numeroMesa: mesa.numeroMesa,
        estado: mesa.estado,
        estadosPermitidos: ['disponible', 'liberada', 'ocupada'],
        esEstadoPermitido: ['disponible', 'liberada', 'ocupada'].includes(mesa.estado)
      });

      // CAMBIO: Validar que la mesa esté disponible o liberada
       if (!['disponible', 'liberada', 'ocupada'].includes(mesa.estado)) {
        console.log('❌ DEBUG - Mesa rechazada. Estado:', mesa.estado);
        return res.status(400).json({ 
          error: `La mesa no acepta nuevos pedidos. Estado actual: ${mesa.estado}` 
        });
      }

      console.log('✅ DEBUG - Mesa ACEPTADA para nuevo pedido');
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

  // ✅ RF012 - Agregar platos a pedido existente - MEJORADO
  async agregarPlatos(req, res) {
    try {
      const { pedidoId } = req.params;
      const { platos } = req.body;

      const pedido = await Pedido.findById(pedidoId).populate('mesa');
      if (!pedido) {
        return res.status(404).json({ error: 'Pedido no encontrado' });
      }

      // AGREGADO: Verificar que la mesa acepte nuevos pedidos
      if (!pedido.mesa.aceptaNuevosPedidos()) {
        return res.status(400).json({
          error: `La mesa no acepta nuevos pedidos. Estado actual: ${pedido.mesa.estado}`
        });
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
      const filtro = { activo: true };

      // 👇 Aseguramos que el rol del usuario exista
      const rolUsuario = req.user?.rol?.toLowerCase?.() || null;

      // 🧩 Si el usuario es cocinero, solo ve pedidos pagados
      if (rolUsuario === 'cocinero') {
        filtro.estadoPago = 'pagado';
      } else {
        // Otros roles (admin, mesero, cajero)
        if (estadoPedido) filtro.estadoPedido = estadoPedido.toLowerCase();
        if (estadoPago) filtro.estadoPago = estadoPago.toLowerCase();
        if (mesa) filtro.mesa = mesa;
      }

      console.log('🔎 Filtro aplicado:', filtro);
      console.log('👤 Rol usuario:', rolUsuario);

      const pedidos = await Pedido.find(filtro)
        .populate('mesa', 'numeroMesa piso sector estado')
        .populate('mesero', 'nombre email rol')
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

  // ✅ NUEVO: Método para cargar la carta con mesa fija
  async cargarCarta(req, res) {
    try {
      const { mesa, pedidoExistente, mesaFija } = req.query;

      const mesas = await Mesa.find({
        $or: [
          { estado: { $in: ['disponible', 'liberada'] } },
          // AGREGADO: Incluir la mesa actual si viene de editar pedido
          ...(mesaFija && mesa ? [{ _id: new mongoose.Types.ObjectId(mesa) }] : [])
        ]
      }).sort('numeroMesa');

      const platos = await Platos.find({
        estado: 'activo',
        stock: { $gt: 0 }
      }).populate('categoria');

      const categorias = await Categoria.find({ estado: 'activa' });

      const userData = {
        _id: req.user._id,
        nombre: req.user.nombre,
        email: req.user.email,
        rol: req.user.rol
      };

      // AGREGADO: Pasar parámetros adicionales a la vista
      res.render('cartaM', {
        usuario: userData,
        platos,
        mesas,
        categorias,
        mesaSeleccionada: mesa, // Mesa fija cuando viene de editar
        pedidoExistente: pedidoExistente,
        mesaFija: mesaFija === 'true' // Forzar selección de mesa
      });

    } catch (error) {
      console.error('Error al cargar carta:', error);
      res.status(500).render('error', {
        mensaje: 'Error al cargar la carta',
        usuario: req.user
      });
    }
  }
}

module.exports = new PedidosController();