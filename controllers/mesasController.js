const Mesa = require('../models/mesasModel');
const Pedido = require('../models/pedidosModel');

class MesasController {
  // 1️⃣ Listar todas las mesas
  async listar(req, res) {
    try {
      const mesas = await Mesa.find().sort({ numeroMesa: 1 });
      res.json(mesas);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  // 2️⃣ Obtener una mesa por ID
  async obtener(req, res) {
    try {
      const mesa = await Mesa.findById(req.params.id)
        .populate('pedidoActual');
      
      if (!mesa) {
        return res.status(404).json({ error: 'Mesa no encontrada' });
      }
      
      res.json(mesa);
    } catch (error) {
      res.status(404).json({ error: error.message });
    }
  }

  // 3️⃣ Crear una nueva mesa
  async crear(req, res) {
  try {
    const { numeroMesa, piso, sector, capacidad } = req.body;

      // CAMBIO: Validaciones mejoradas según modelo actualizado
      if (!numeroMesa || !piso || !sector) {
        return res.status(400).json({ error: 'Número de mesa, piso y sector son requeridos' });
      }

    // Verificar si el número de mesa ya existe
    const mesaExistente = await Mesa.findOne({ numeroMesa });
    if (mesaExistente) {
      return res.status(400).json({ error: 'El número de mesa ya existe' });
    }

    const nuevaMesa = new Mesa({
      numeroMesa,
      piso,
      sector,
      capacidad: capacidad || 4,
      estado: 'disponible'
    });

    await nuevaMesa.save();

    res.status(201).json({
      mensaje: 'Mesa creada con éxito',
      mesa: nuevaMesa
    });

  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}


  // 4️⃣ Actualizar mesa
  async actualizar(req, res) {
    try {
      const mesaActualizada = await Mesa.findByIdAndUpdate(
        req.params.id,
        req.body,
        { new: true, runValidators: true }
      );
      
      if (!mesaActualizada) {
        return res.status(404).json({ error: 'Mesa no encontrada' });
      }
      
      res.json({
        mensaje: 'Mesa actualizada con éxito',
        mesa: mesaActualizada
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  // 5️⃣ Eliminar mesa (solo si no tiene pedidos activos)
  async eliminar(req, res) {
    try {
      const mesa = await Mesa.findById(req.params.id);
      if (!mesa) {
        return res.status(404).json({ error: 'Mesa no encontrada' });
      }

      // Verificar si tiene pedidos activos
      const pedidosActivos = await Pedido.find({
        mesa: req.params.id,
        estadoPago: 'pendiente',
        activo: true
      });

      if (pedidosActivos.length > 0) {
        return res.status(400).json({ 
          error: 'No se puede eliminar: la mesa tiene pedidos activos' 
        });
      }

      await Mesa.findByIdAndDelete(req.params.id);
      res.json({ mensaje: 'Mesa eliminada correctamente' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  // 6️⃣ Filtrar mesas por estado o piso
  async filtrar(req, res) {
    try {
      const { estado, piso, sector } = req.query;
      const query = {};
      
      if (estado) query.estado = estado;
      if (piso) query.piso = piso;
      if (sector) query.sector = sector;

      const mesas = await Mesa.find(query).sort({ numeroMesa: 1 });
      res.json(mesas);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  // 7️⃣ ✅ RF013 - Cambiar estado de la mesa manualmente
  async cambiarEstado(req, res) {
    try {
      const { estado } = req.body;
      const estadosPermitidos = ['disponible', 'ocupada', 'atendida', 'liberada', 'reparacion'];
      
      if (!estadosPermitidos.includes(estado)) {
        return res.status(400).json({ error: 'Estado no válido' });
      }

      const mesa = await Mesa.findByIdAndUpdate(
        req.params.id,
        { estado },
        { new: true }
      );

      if (!mesa) {
        return res.status(404).json({ error: 'Mesa no encontrada' });
      }

      res.json({
        mensaje: `Estado de la mesa actualizado a: ${estado}`,
        mesa: mesa
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  // 8️⃣ Contar mesas por estado
  async contarPorEstado(req, res) {
    try {
      const conteo = await Mesa.aggregate([
        { $group: { _id: "$estado", total: { $sum: 1 } } }
      ]);
      res.json(conteo);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  // 9️⃣ Traer mesas con pedidos activos
  async mesasConPedidos(req, res) {
    try {
      const mesas = await Mesa.find().sort({ numeroMesa: 1 });
      const resultado = [];

      for (const mesa of mesas) {
        const pedidosActivos = await Pedido.find({
          mesa: mesa._id,
          estadoPago: 'pendiente',
          activo: true
        })
        .populate('mesero', 'nombre')
        .populate('platos.plato', 'nombre precio');

        resultado.push({
          mesa,
          pedidosActivos,
          totalPedidosActivos: pedidosActivos.length
        });
      }

      res.json(resultado);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  // 🔟 Obtener historial de pedidos de una mesa
  async historialMesa(req, res) {
    try {
      const { id } = req.params;
      
      const pedidos = await Pedido.find({ 
        mesa: id,
        activo: true 
      })
      .populate('mesero', 'nombre')
      .populate('platos.plato', 'nombre precio')
      .sort({ fechaPedido: -1 });

      res.json(pedidos);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  // NUEVO: ✅ RF013 - Liberar mesa específica
  async liberarMesa(req, res) {
    try {
      const { id } = req.params;
      
      const mesa = await Mesa.findById(id);
      if (!mesa) {
        return res.status(404).json({ error: 'Mesa no encontrada' });
      }

      mesa.estado = 'liberada';
      mesa.pedidoActual = null;
      await mesa.save();

      res.json({
        mensaje: 'Mesa liberada exitosamente',
        mesa: mesa
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = new MesasController();