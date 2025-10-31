const Mesa = require('../models/mesaModel');

class MesaService {

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

  // Crear una nueva mesa - CORREGIDO
  async create(data) {
    // Encontrar el último número de mesa para autoincrementar
    const ultimaMesa = await Mesa.findOne().sort({ numeroMesa: -1 });
    const siguienteNumero = ultimaMesa ? ultimaMesa.numeroMesa + 1 : 1;

    // Validar piso
    if (!['piso 1', 'piso 2', 'piso 3'].includes(data.piso)) {
      throw new Error('Piso inválido');
    }

    // Validar sector
    if (!['vid', 'valcon', 'normal'].includes(data.sector)) {
      throw new Error('Sector inválido');
    }

    // Crear nueva mesa
    const mesa = new Mesa({
      numeroMesa: siguienteNumero, // ✅ AGREGADO
      piso: data.piso,
      sector: data.sector,
      estado: data.estado || 'liberada'
    });

    return await mesa.save();
  }

  // Actualizar mesa - CORREGIDO
  async update(id, data) {
    const mesa = await Mesa.findById(id);
    if (!mesa) throw new Error('Mesa no encontrada');

    if (data.piso) {
      if (!['piso 1', 'piso 2', 'piso 3'].includes(data.piso)) {
        throw new Error('Piso inválido');
      }
      mesa.piso = data.piso;
    }

    if (data.sector) {
      if (!['vid', 'valcon', 'normal'].includes(data.sector)) {
        throw new Error('Sector inválido');
      }
      mesa.sector = data.sector;
    }

    if (data.estado) {
      if (!['atendida', 'liberada', 'ocupada'].includes(data.estado)) {
        throw new Error('Estado inválido');
      }
      mesa.estado = data.estado;
    }

    return await mesa.save();
  }

  // Eliminar mesa
  async delete(id) {
    const mesa = await Mesa.findByIdAndDelete(id);
    if (!mesa) throw new Error('Mesa no encontrada');
    return mesa;
  }
}

module.exports = MesaService;