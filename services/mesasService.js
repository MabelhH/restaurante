const Mesa = require('../models/mesasModel');

class MesasService {
  // Traer todas las mesas
  async getAll() {
    return await Mesa.find().sort({ numeroMesa: 1 });
  }

  // Traer una mesa por ID
  async getById(id) {
    const mesa = await Mesa.findById(id);
    if (!mesa) throw new Error('Mesa no encontrada');
    return mesa;
  }

  // Crear una nueva mesa
  async create(data) {
    // CAMBIO: Validar que el número de mesa sea único
    const mesaExistente = await Mesa.findOne({ numeroMesa: data.numeroMesa });
    if (mesaExistente) {
      throw new Error(`El número de mesa ${data.numeroMesa} ya existe.`);
    }

    // CAMBIO: Usar el modelo actualizado con los campos correctos
    const mesa = new Mesa({
      numeroMesa: data.numeroMesa,
      piso: data.piso,
      sector: data.sector,
      capacidad: data.capacidad || 4,
      estado: data.estado || 'disponible'
    });

    return await mesa.save();
  }

  // Actualizar mesa
  async update(id, data) {
    const mesa = await Mesa.findById(id);
    if (!mesa) throw new Error('Mesa no encontrada');

    // CAMBIO: Validar número de mesa único al actualizar
    if (data.numeroMesa && data.numeroMesa !== mesa.numeroMesa) {
      const mesaExistente = await Mesa.findOne({ 
        numeroMesa: data.numeroMesa, 
        _id: { $ne: id } 
      });
      if (mesaExistente) {
        throw new Error(`El número de mesa ${data.numeroMesa} ya existe.`);
      }
      mesa.numeroMesa = data.numeroMesa;
    }

    // CAMBIOS: Actualizar campos según el modelo actualizado
    if (data.piso) mesa.piso = data.piso;
    if (data.sector) mesa.sector = data.sector;
    if (data.estado) mesa.estado = data.estado;
    if (data.capacidad) mesa.capacidad = data.capacidad;

    return await mesa.save();
  }

  // Eliminar mesa
  async delete(id) {
    const mesa = await Mesa.findByIdAndDelete(id);
    if (!mesa) throw new Error('Mesa no encontrada');
    return mesa;
  }

  // NUEVO: Liberar mesa (RF013)
  async liberarMesa(id) {
    const mesa = await Mesa.findById(id);
    if (!mesa) throw new Error('Mesa no encontrada');

    mesa.estado = 'liberada';
    mesa.pedidoActual = null;
    return await mesa.save();
  }

  // NUEVO: Marcar mesa como atendida
  async marcarAtendida(id) {
    const mesa = await Mesa.findById(id);
    if (!mesa) throw new Error('Mesa no encontrada');

    mesa.estado = 'atendida';
    return await mesa.save();
  }

  // NUEVO: Obtener mesas por estado
  async getByEstado(estado) {
    return await Mesa.find({ estado }).sort({ numeroMesa: 1 });
  }
}

module.exports = MesasService;