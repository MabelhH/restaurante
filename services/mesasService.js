const Mesa = require('../models/mesasModel');
const cron = require('node-cron');

class MesasService {
  // Traer todas las mesas
  constructor() {
    this.iniciarLiberacionAutomatica();
  }
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

  async liberarTodasLasMesas() {
    try {
      const resultado = await Mesa.updateMany(
        { 
          estado: { $in: ['ocupada', 'atendida', 'reservada', 'liberada'] } 
        },
        { 
          $set: { 
            estado: 'disponible',
            pedidoActual: null,
            ultimaLiberacion: new Date()
          } 
        }
      );

      console.log(`🔄 [${new Date().toLocaleString()}] ${resultado.modifiedCount} mesas liberadas automáticamente`);
      return resultado;
    } catch (error) {
      console.error('❌ Error liberando mesas:', error);
      throw error;
    }
  }

  // NUEVO: Obtener estadísticas de mesas
  async obtenerEstadisticas() {
    const totalMesas = await Mesa.countDocuments();
    const mesasDisponibles = await Mesa.countDocuments({ estado: 'disponible' });
    const mesasOcupadas = await Mesa.countDocuments({ estado: 'ocupada' });
    const mesasAtendidas = await Mesa.countDocuments({ estado: 'atendida' });
    const mesasReservadas = await Mesa.countDocuments({ estado: 'reservada' });
    const mesasLiberadas = await Mesa.countDocuments({ estado: 'liberada' });
    
    return {
      totalMesas,
      mesasDisponibles,
      mesasOcupadas,
      mesasAtendidas,
      mesasReservadas,
      mesasLiberadas,
      mesasPorLiberar: mesasOcupadas + mesasAtendidas + mesasReservadas + mesasLiberadas
    };
  }

  iniciarLiberacionAutomatica() {
    console.log('⏰ Iniciando liberación automática de mesas...');

    // 🔹 LIBERACIÓN NOCTURNA: 9:30 PM (21:30)
    cron.schedule('30 21 * * *', async () => {
      await this.ejecutarLiberacionAutomatica('9:30 PM');
    });

    // 🔹 LIBERACIÓN MATUTINA: 6:00 AM 
    cron.schedule('0 6 * * *', async () => {
      await this.ejecutarLiberacionAutomatica('6:00 AM');
    });
    // 🔹 MODO DESARROLLO: Cada 5 minutos para pruebas
    if (process.env.NODE_ENV === 'development') {
      cron.schedule('*/5 * * * *', async () => {
        console.log('🧪 [DESARROLLO] Verificación de liberación automática');
        // Opcional: ejecutar en desarrollo
        // await this.ejecutarLiberacionAutomatica('Prueba Desarrollo');
      });
    }

    console.log('✅ Liberación automática programada: 9:30 PM y 6:00 AM ');
  }

  // NUEVO: Ejecutar liberación automática
  async ejecutarLiberacionAutomatica(hora = 'Manual') {
    try {
      console.log(`🕒 Iniciando liberación automática (${hora})...`);
      
      const statsAntes = await this.obtenerEstadisticas();
      const resultado = await this.liberarTodasLasMesas();
      const statsDespues = await this.obtenerEstadisticas();

      console.log(`✅ Liberación completada: ${resultado.modifiedCount} mesas liberadas`);
      console.log(`📊 Estadísticas - Antes: ${statsAntes.mesasPorLiberar} por liberar, Después: ${statsDespues.mesasPorLiberar} por liberar`);

      return {
        success: true,
        horaEjecucion: hora,
        mesasLiberadas: resultado.modifiedCount,
        estadisticas: {
          antes: statsAntes,
          despues: statsDespues
        }
      };
    } catch (error) {
      console.error(`❌ Error en liberación automática (${hora}):`, error.message);
      return {
        success: false,
        horaEjecucion: hora,
        error: error.message
      };
    }
  }

  // NUEVO: Liberación manual desde API
  async liberacionManual() {
    return await this.ejecutarLiberacionAutomatica('Manual');
  }

  // NUEVO: Obtener estado del servicio de liberación
  getEstadoLiberacion() {
    return {
      servicioActivo: true,
      horariosProgramados: [
        '30 21 * * *',  // 9:30 PM
        '0 6 * * *'   // 6:00 AM  
      ],
      horariosLegibles: [
        '9:30 PM - Liberación nocturna',
        '6:00 AM - Liberación matutina'
      ],
      descripcion: 'Liberación automática de mesas 2 veces al día',
      ultimaEjecucion: new Date(),
      proximaEjecucion: this.calcularProximaLiberacion()
    };
  }
  // Calcular próxima liberación
  calcularProximaLiberacion() {
    const ahora = new Date();
    const hoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
    
    // 6:00 AM
    const manana6am = new Date(hoy);
    manana6am.setDate(manana6am.getDate() + 1);
    manana6am.setHours(6, 0, 0, 0);
    
    // 9:30 PM
    const hoy930pm = new Date(hoy);
    hoy930pm.setHours(21, 30, 0, 0);
    
    if (ahora < hoy930pm) {
      return hoy930pm;
    } else {
      return manana6am;
    }
  }
}

module.exports = MesasService;