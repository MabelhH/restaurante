const cron = require('node-cron');
const Reserva = require('../models/reservaModel');
const Cliente = require('../models/clienteModel');
const Mesa = require('../models/mesasModel');

class ReservaService {
  constructor() {
    this.iniciarVerificadorReservas();
  }

  // ==================== SISTEMA AUTOMÁTICO DE RESERVAS ====================

  iniciarVerificadorReservas() {
    // Ejecutar cada minuto para verificar reservas
    cron.schedule('* * * * *', async () => {
      try {
        await this.verificarYActivarReservas();
        await this.verificarYLiberarReservas();
      } catch (error) {
        console.error('Error en verificador de reservas:', error);
      }
    });

    console.log('✅ Verificador automático de reservas iniciado');
  }

  async verificarYActivarReservas() {
    const ahora = new Date();
    
    // Buscar reservas confirmadas que deben activarse
    const reservasParaActivar = await Reserva.find({
      estadoReserva: 'confirmada',
      activo: true
    }).populate('mesas');

    for (const reserva of reservasParaActivar) {
      const fechaHoraReserva = this.combinarFechaYHora(reserva.diaReserva, reserva.horaReserva);
      
      // Si es la hora de la reserva (con margen de 15 minutos antes)
      if (fechaHoraReserva <= new Date(ahora.getTime() + 15 * 60000)) {
        await this.activarReserva(reserva);
      }
    }
  }

  async verificarYLiberarReservas() {
    const ahora = new Date();
    const dosHorasAtras = new Date(ahora.getTime() - 2 * 60 * 60000);

    // Buscar mesas en estado "reserva" que fueron activadas hace más de 2 horas
    const mesasConReserva = await Mesa.find({
      estado: 'reserva'
    });

    for (const mesa of mesasConReserva) {
      // Buscar la reserva activa para esta mesa
      const reservaActiva = await Reserva.findOne({
        mesas: mesa._id,
        estadoReserva: 'confirmada',
        activo: true
      });

      if (reservaActiva) {
        const fechaHoraReserva = this.combinarFechaYHora(reservaActiva.diaReserva, reservaActiva.horaReserva);
        
        // Si han pasado más de 2 horas desde la hora de reserva, liberar
        if (fechaHoraReserva <= dosHorasAtras) {
          await this.liberarMesaReserva(mesa._id, reservaActiva._id);
        }
      }
    }
  }

  combinarFechaYHora(fecha, horaString) {
    const [horas, minutos] = horaString.split(':').map(Number);
    const fechaHora = new Date(fecha);
    fechaHora.setHours(horas, minutos, 0, 0);
    return fechaHora;
  }

  async activarReserva(reserva) {
    try {
      // Verificar si ya está activada
      const primeraMesa = await Mesa.findById(reserva.mesas[0]);
      if (primeraMesa.estado === 'reserva') {
        return; // Ya está activada
      }

      // Cambiar estado de todas las mesas a "reserva"
      for (const mesaId of reserva.mesas) {
        await Mesa.findByIdAndUpdate(mesaId, {
          estado: 'reserva'
        });
      }

      console.log(`✅ Reserva ${reserva._id} activada - Mesas marcadas como reservadas`);
    } catch (error) {
      console.error(`❌ Error activando reserva ${reserva._id}:`, error);
    }
  }

  async liberarMesaReserva(mesaId, reservaId) {
    try {
      await Mesa.findByIdAndUpdate(mesaId, {
        estado: 'disponible'
      });

      console.log(`🔄 Mesa ${mesaId} liberada de reserva ${reservaId}`);
    } catch (error) {
      console.error(`❌ Error liberando mesa ${mesaId}:`, error);
    }
  }

  programarActivacionIndividual(reserva) {
    const fechaHoraReserva = this.combinarFechaYHora(reserva.diaReserva, reserva.horaReserva);
    const ahora = new Date();
    const tiempoEspera = fechaHoraReserva - ahora - (15 * 60000); // 15 minutos antes

    if (tiempoEspera > 0) {
      setTimeout(async () => {
        try {
          const reservaActualizada = await Reserva.findById(reserva._id).populate('mesas');
          if (reservaActualizada && reservaActualizada.estadoReserva === 'confirmada') {
            await this.activarReserva(reservaActualizada);
          }
        } catch (error) {
          console.error(`❌ Error en activación programada de reserva ${reserva._id}:`, error);
        }
      }, tiempoEspera);
    }
  }

  // ==================== MÉTODOS CRUD PRINCIPALES ====================

  async getAll() {
    return await Reserva.find({ activo: true })
      .populate('cliente', 'nombre email telefono')
      .populate('mesas', 'numeroMesa capacidad piso sector estado')
      .sort({ diaReserva: -1, horaReserva: -1 });
  }

  async getById(id) {
    const reserva = await Reserva.findById(id)
      .populate('cliente', 'nombre email telefono')
      .populate('mesas', 'numeroMesa capacidad piso sector estado');

    if (!reserva || !reserva.activo) {
      throw new Error('Reserva no encontrada');
    }
    return reserva;
  }

  async create(data) {
    console.log('🔍 Buscando cliente con ID:', data.cliente);
    console.log('🔍 Mesas solicitadas:', data.mesas);

    // Validar que el cliente existe
    const cliente = await Cliente.findById(data.cliente);
    if (!cliente) {
      throw new Error('Cliente no encontrado');
    }

    // Validar que las mesas existen
    if (!data.mesas || data.mesas.length === 0) {
      throw new Error('Se requiere al menos una mesa');
    }

    console.log('🔍 Buscando mesas con IDs:', data.mesas);

    const mesas = await Mesa.find({ 
      _id: { $in: data.mesas }
    });

    console.log('📋 Mesas encontradas:', mesas);

    if (mesas.length !== data.mesas.length) {
      throw new Error('Una o más mesas no existen');
    }

    // Validar que las mesas estén disponibles
    const mesasNoDisponibles = mesas.filter(mesa => mesa.estado !== 'disponible');
    if (mesasNoDisponibles.length > 0) {
      throw new Error(`Las mesas ${mesasNoDisponibles.map(m => m.numeroMesa).join(', ')} no están disponibles`);
    }

    // Verificar disponibilidad
    const disponibles = await this.verificarDisponibilidadMesas(
      data.diaReserva,
      data.horaReserva,
      data.mesas
    );
    
    if (!disponibles) {
      throw new Error('Una o más mesas están ocupadas en la fecha y hora seleccionadas');
    }

    // Crear la reserva
    const nuevaReserva = new Reserva(data);
    await nuevaReserva.save();

    // Programar activación automática si la reserva está confirmada
    if (data.estadoReserva === 'confirmada') {
      this.programarActivacionIndividual(nuevaReserva);
    }

    return await Reserva.findById(nuevaReserva._id)
      .populate('cliente', 'nombre email telefono')
      .populate('mesas', 'numeroMesa capacidad piso sector estado');
  }

  async update(id, data) {
    console.log('🔍 Actualizando reserva ID:', id);
    console.log('🔍 Datos nuevos:', data);

    // Buscar la reserva
    const reserva = await Reserva.findById(id);
    if (!reserva || !reserva.activo) {
      throw new Error('Reserva no encontrada');
    }

    // Validar cliente si se intenta cambiar
    if (data.cliente && data.cliente !== reserva.cliente.toString()) {
      const cliente = await Cliente.findById(data.cliente);
      if (!cliente) {
        throw new Error('Cliente no encontrado');
      }
    }

    // Validar mesas si se intenta cambiar
    if (data.mesas) {
      if (!Array.isArray(data.mesas) || data.mesas.length === 0) {
        throw new Error('Se requiere al menos una mesa');
      }

      const mesas = await Mesa.find({ _id: { $in: data.mesas } });

      if (mesas.length !== data.mesas.length) {
        throw new Error('Una o más mesas no existen');
      }

      const mesasNoDisponibles = mesas.filter(m => m.estado !== 'disponible');
      if (mesasNoDisponibles.length > 0) {
        throw new Error(
          `Las mesas ${mesasNoDisponibles.map(m => m.numeroMesa).join(', ')} no están disponibles`
        );
      }

      // Verificar que las mesas no estén ocupadas en la misma fecha y hora
      const disponibles = await this.verificarDisponibilidadMesas(
          data.diaReserva || reserva.diaReserva,
          data.horaReserva || reserva.horaReserva,
          data.mesas,
          reserva._id // ignorar la reserva actual
      );
      if (!disponibles) {
        throw new Error('Una o más mesas están ocupadas en la fecha y hora seleccionadas');
      }
    }

    // Actualizar campos permitidos
    reserva.cliente = data.cliente || reserva.cliente;
    reserva.mesas = data.mesas || reserva.mesas;
    reserva.diaReserva = data.diaReserva || reserva.diaReserva;
    reserva.horaReserva = data.horaReserva || reserva.horaReserva;
    reserva.estadoReserva = data.estadoReserva || reserva.estadoReserva;

    await reserva.save();

    // Si se confirma la reserva, programar activación
    if (data.estadoReserva === 'confirmada') {
      this.programarActivacionIndividual(reserva);
    }

    // Retornar reserva actualizada con populate
    return await Reserva.findById(reserva._id)
      .populate('cliente', 'nombre email telefono')
      .populate('mesas', 'numeroMesa capacidad piso sector estado');
  }

  async delete(id) {
    const reserva = await Reserva.findById(id);
    if (!reserva || !reserva.activo) {
      throw new Error('Reserva no encontrada');
    }

    // Liberar mesas antes de desactivar la reserva
    await this.liberarMesasDeReserva(id);

    return await Reserva.findByIdAndUpdate(
      id, 
      { activo: false }, 
      { new: true }
    );
  }

  // ==================== MÉTODOS DE CONSULTA ====================

  async getReservasPorFecha(fecha) {
    const startOfDay = new Date(fecha);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(fecha);
    endOfDay.setHours(23, 59, 59, 999);

    return await Reserva.find({
      diaReserva: {
        $gte: startOfDay,
        $lte: endOfDay
      },
      activo: true
    })
    .populate('cliente', 'nombre email telefono')
    .populate('mesas', 'numeroMesa capacidad piso sector estado')
    .sort({ horaReserva: 1 });
  }

  async getReservasPorCliente(clienteId) {
    return await Reserva.find({
      cliente: clienteId,
      activo: true
    })
    .populate('mesas', 'numeroMesa capacidad piso sector estado')
    .sort({ diaReserva: -1, horaReserva: -1 });
  }

  async getReservasPorEstado(estado) {
    const estadosPermitidos = ['pendiente', 'confirmada', 'cancelada', 'finalizada'];
    if (!estadosPermitidos.includes(estado)) {
      throw new Error('Estado no válido');
    }

    return await Reserva.find({
      estadoReserva: estado,
      activo: true
    })
    .populate('cliente', 'nombre email telefono')
    .populate('mesas', 'numeroMesa capacidad piso sector estado')
    .sort({ diaReserva: 1, horaReserva: 1 });
  }

  async getReservasPorRango(fechaInicio, fechaFin) {
    const startDate = new Date(fechaInicio);
    startDate.setHours(0, 0, 0, 0);
    
    const endDate = new Date(fechaFin);
    endDate.setHours(23, 59, 59, 999);

    return await Reserva.find({
      diaReserva: {
        $gte: startDate,
        $lte: endDate
      },
      activo: true
    })
    .populate('cliente', 'nombre email telefono')
    .populate('mesas', 'numeroMesa capacidad piso sector estado')
    .sort({ diaReserva: 1, horaReserva: 1 });
  }

  // ==================== MÉTODOS DE GESTIÓN DE ESTADOS ====================

  async cambiarEstado(id, estado) {
    const estadosPermitidos = ['pendiente', 'confirmada', 'cancelada', 'finalizada'];
    if (!estadosPermitidos.includes(estado)) {
      throw new Error('Estado no válido');
    }

    const reserva = await Reserva.findById(id).populate('mesas');
    if (!reserva || !reserva.activo) {
      throw new Error('Reserva no encontrada');
    }

    // Manejar cambios de estado específicos
    if (estado === 'confirmada' && reserva.estadoReserva !== 'confirmada') {
      // Programar activación automática
      this.programarActivacionIndividual(reserva);
    } else if ((estado === 'cancelada' || estado === 'finalizada') && 
               reserva.estadoReserva === 'confirmada') {
      // Liberar mesas si se cancela o finaliza una reserva confirmada
      await this.liberarMesasDeReserva(id);
    }

    const reservaActualizada = await Reserva.findByIdAndUpdate(
      id,
      { estadoReserva: estado },
      { new: true }
    )
    .populate('cliente', 'nombre email telefono')
    .populate('mesas', 'numeroMesa capacidad piso sector estado');

    console.log(`🔄 Estado de reserva ${id} cambiado a: ${estado}`);
    return reservaActualizada;
  }

  // ==================== MÉTODOS DE DISPONIBILIDAD ====================

  async verificarDisponibilidadMesas(diaReserva, horaReserva, mesasIds, reservaId = null) {
    const dia = new Date(diaReserva);

    const reservasExistentes = await Reserva.find({
      mesas: { $in: mesasIds },
      diaReserva: dia,
      horaReserva: horaReserva,
      estadoReserva: { $in: ['pendiente', 'confirmada'] },
      activo: true,
      ...(reservaId ? { _id: { $ne: reservaId } } : {})  // Ignorar la reserva actual
    });

    return reservasExistentes.length === 0;
  }

  async getMesasDisponibles(diaReserva, horaReserva) {
    const dia = new Date(diaReserva);
    
    // Obtener mesas ocupadas en esa fecha y hora
    const reservas = await Reserva.find({
      diaReserva: dia,
      horaReserva: horaReserva,
      estadoReserva: { $in: ['pendiente', 'confirmada'] },
      activo: true
    });

    const mesasOcupadasIds = reservas.flatMap(reserva => reserva.mesas);
    
    // Devolver todas las mesas activas que no estén ocupadas
    return await Mesa.find({
      _id: { $nin: mesasOcupadasIds },
      estado: 'disponible'
    });
  }

  // ==================== MÉTODOS AUXILIARES ====================

  async liberarMesasDeReserva(reservaId) {
    try {
      const reserva = await Reserva.findById(reservaId).populate('mesas');
      if (!reserva) return;

      for (const mesa of reserva.mesas) {
        await Mesa.findByIdAndUpdate(mesa._id, {
          estado: 'disponible'
        });
      }

      console.log(`🔄 Mesas de reserva ${reservaId} liberadas`);
    } catch (error) {
      console.error(`❌ Error liberando mesas de reserva ${reservaId}:`, error);
    }
  }

  // Método para forzar la activación inmediata de una reserva (útil para testing)
  async forzarActivacionReserva(reservaId) {
    const reserva = await Reserva.findById(reservaId).populate('mesas');
    if (!reserva) {
      throw new Error('Reserva no encontrada');
    }

    await this.activarReserva(reserva);
    return { message: `Reserva ${reservaId} activada manualmente` };
  }

  // Método para obtener estadísticas de reservas
  async getEstadisticas() {
    const totalReservas = await Reserva.countDocuments({ activo: true });
    const reservasConfirmadas = await Reserva.countDocuments({ 
      estadoReserva: 'confirmada', 
      activo: true 
    });
    const reservasHoy = await Reserva.countDocuments({
      diaReserva: {
        $gte: new Date().setHours(0, 0, 0, 0),
        $lte: new Date().setHours(23, 59, 59, 999)
      },
      activo: true
    });

    return {
      totalReservas,
      reservasConfirmadas,
      reservasHoy,
      mesasEnReserva: await Mesa.countDocuments({ estado: 'reserva' })
    };
  }
}

module.exports = ReservaService;