const MesaService = require('../services/mesaService');
const Mesa = require('../models/mesaModel'); // ✅ AGREGAR ESTO
const Pedido = require('../models/Pedido');

class MesaController {

  //  Listar todas las mesas
  async listar(req, res) {
    try {
      const mesas = await mesaService.getAll();
      res.json(mesas);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  //  Obtener una mesa por ID
  async obtener(req, res) {
    try {
      const mesa = await mesaService.getById(req.params.id);
      res.json(mesa);
    } catch (error) {
      res.status(404).json({ error: error.message });
    }
  }

  //  Crear una nueva mesa
  async crear(req, res) {
    try {
      const nuevaMesa = await mesaService.create(req.body);
      res.json(nuevaMesa);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  // Actualizar mesa
  async actualizar(req, res) {
    try {
      const mesaActualizada = await mesaService.update(req.params.id, req.body);
      res.json(mesaActualizada);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  //  Eliminar mesa (solo si no tiene pedidos pendientes)
  async eliminar(req, res) {
    try {
      const pedidosActivos = await Pedido.find({
        mesa: req.params.id,
        estado: { $ne: 'entregado' }
      });

      if (pedidosActivos.length > 0) {
        return res.status(400).json({ error: 'No se puede eliminar: la mesa tiene pedidos activos' });
      }

      await mesaService.delete(req.params.id);
      res.json({ mensaje: 'Mesa eliminada correctamente' });
    } catch (error) {
      res.status(404).json({ error: error.message });
    }
  }

  // 6Filtrar mesas por estado o piso - CORREGIDO
  async filtrar(req, res) {
    try {
      const { estado, piso } = req.query;
      const query = {};
      if (estado) query.estado = estado;
      if (piso) query.piso = piso;

      const mesas = await Mesa.find(query); 
      res.json(mesas);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  //  Cambiar el estado de la mesa manualmente
  async cambiarEstado(req, res) {
    try {
      const { estado } = req.body;
      const mesa = await mesaService.update(req.params.id, { estado });
      res.json(mesa);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  //  Contar mesas por estado - 
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

  // 9️ Traer mesas con pedidos activos
  async mesasConPedidos(req, res) {
    try {
      const mesas = await mesaService.getAll();
      const resultado = [];

      for (const mesa of mesas) {
        const pedidosActivos = await Pedido.find({
          mesa: mesa._id,
          estado: { $ne: 'entregado' }
        }).populate('platos.producto', 'nombre precio');

        resultado.push({
          mesa,
          pedidosActivos
        });
      }

      res.json(resultado);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
}

const mesaService = new MesaService(); //  MOVER AQUÍ después de definir la clase
module.exports = new MesaController();