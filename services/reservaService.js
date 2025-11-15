const cron = require('node-cron');
const Reserva = require('../models/reservaModel');
const Cliente = require('../models/clienteModel');
const Mesa = require('../models/mesasModel');

class ReservaService {
  constructor() {
    this.notificaciones = [];
    this.iniciarVerificadorReservas();
  }

  // ==================== SISTEMA AUTOMÁTICO DE RESERVAS ====================

  iniciarVerificadorReservas() {
    // Ejecutar cada minuto para verificar reservas
    cron.schedule('* * * * *', async () => {
      try {
        await this.verificarYActivarReservas();
        await this.verificarYLiberarReservas();
        await this.verificarReservasProximas(); 
        await this.verificarReservasVencidas(); 
      } catch (error) {
        console.error('Error en verificador de reservas:', error);
      }
    });

    console.log('✅ Verificador automático de reservas iniciado');
  }
  
  async generarNotificacionReservaProxima(reserva) {
    try {
      const fechaHoraReserva = this.combinarFechaYHora(reserva.diaReserva, reserva.horaReserva);
      const ahora = new Date();
      const diferenciaMs = fechaHoraReserva - ahora;
      const minutosRestantes = Math.floor(diferenciaMs / (1000 * 60));

      const notificacion = {
        id: Date.now().toString(),
        tipo: 'reserva_proxima',
        titulo: '⏰ Reserva Próxima',
        mensaje: `La reserva de ${reserva.cliente.nombre} ${reserva.cliente.apellido} es en ${minutosRestantes} minutos`,
        reservaId: reserva._id,
        cliente: `${reserva.cliente.nombre} ${reserva.cliente.apellido}`,
        horaReserva: reserva.horaReserva,
        mesas: reserva.mesas ? reserva.mesas.map(m => m.numeroMesa) : [],
        timestamp: new Date(),
        leida: false
      };

      // ✅ VERIFICAR QUE this.notificaciones EXISTA
      if (!this.notificaciones) {
        this.notificaciones = [];
      }

      this.notificaciones.push(notificacion);
      
      // Mantener solo las últimas 50 notificaciones
      if (this.notificaciones.length > 50) {
        this.notificaciones = this.notificaciones.slice(-50);
      }

      console.log(`🔔 NOTIFICACIÓN: ${notificacion.mensaje}`);
      return notificacion;
    } catch (error) {
      console.error('Error al generar notificación de reserva próxima:', error);
      return null;
    }
  }

  async generarNotificacionReservaVencida(reserva) {
    try {
      const notificacion = {
        id: Date.now().toString(),
        tipo: 'reserva_vencida',
        titulo: '❌ Reserva Vencida',
        mensaje: `La reserva de ${reserva.cliente.nombre} ${reserva.cliente.apellido} fue cancelada automáticamente`,
        reservaId: reserva._id,
        cliente: `${reserva.cliente.nombre} ${reserva.cliente.apellido}`,
        timestamp: new Date(),
        leida: false
      };

      // ✅ VERIFICAR QUE this.notificaciones EXISTA
      if (!this.notificaciones) {
        this.notificaciones = [];
      }

      this.notificaciones.push(notificacion);
      
      if (this.notificaciones.length > 50) {
        this.notificaciones = this.notificaciones.slice(-50);
      }

      console.log(`🔔 NOTIFICACIÓN: ${notificacion.mensaje}`);
      return notificacion;
    } catch (error) {
      console.error('Error al generar notificación de reserva vencida:', error);
      return null;
    }
  }

  // Método para obtener notificaciones no leídas
  getNotificacionesNoLeidas() {
    try {
      // ✅ VERIFICAR QUE this.notificaciones EXISTA Y SEA UN ARRAY
      if (!this.notificaciones || !Array.isArray(this.notificaciones)) {
        console.log('⚠️ Notificaciones no inicializadas, retornando array vacío');
        this.notificaciones = [];
        return [];
      }
      
      return this.notificaciones.filter(notif => !notif.leida);
    } catch (error) {
      console.error('Error en getNotificacionesNoLeidas:', error);
      return [];
    }
  }

  // Método para obtener todas las notificaciones
  getTodasLasNotificaciones() {
    try {
      // ✅ VERIFICAR QUE this.notificaciones EXISTA
      if (!this.notificaciones || !Array.isArray(this.notificaciones)) {
        console.log('⚠️ Notificaciones no inicializadas, retornando array vacío');
        this.notificaciones = [];
        return [];
      }
      
      return this.notificaciones;
    } catch (error) {
      console.error('Error en getTodasLasNotificaciones:', error);
      return [];
    }
  }

  // Método para marcar notificación como leída
  marcarNotificacionLeida(id) {
    try {
      // ✅ VERIFICAR QUE this.notificaciones EXISTA
      if (!this.notificaciones || !Array.isArray(this.notificaciones)) {
        console.log('⚠️ Notificaciones no inicializadas, no se puede marcar como leída');
        return;
      }

      const notificacion = this.notificaciones.find(notif => notif.id === id);
      if (notificacion) {
        notificacion.leida = true;
        console.log(`✅ Notificación ${id} marcada como leída`);
      }
    } catch (error) {
      console.error('Error en marcarNotificacionLeida:', error);
    }
  }

  async confirmarReserva(id) {
    console.log('✅ Confirmando reserva ID:', id);
    
    const reserva = await Reserva.findById(id).populate('mesas');
    if (!reserva || !reserva.activo) {
      throw new Error('Reserva no encontrada');
    }

    // Verificar que esté en estado pendiente
    if (reserva.estadoReserva !== 'pendiente') {
      throw new Error('Solo se pueden confirmar reservas pendientes');
    }

    // Verificar tiempo de confirmación (10 min antes hasta 15 min después)
    const ahora = new Date();
    const fechaHoraReserva = this.combinarFechaYHora(reserva.diaReserva, reserva.horaReserva);
    
    const diferenciaMs = fechaHoraReserva - ahora;
    const diferenciaMinutos = diferenciaMs / (1000 * 60);
    
    // Permitir confirmar desde 10 minutos antes hasta 15 minutos después
    if (diferenciaMinutos > 10) {
      throw new Error(`Solo puedes confirmar la reserva 10 minutos antes de la hora programada. Tiempo restante: ${Math.ceil(diferenciaMinutos - 10)} minutos`);
    }
    
    if (diferenciaMinutos < -15) {
      throw new Error('No se puede confirmar la reserva. Ha pasado más de 15 minutos de la hora programada.');
    }

    // Cambiar estado a confirmada
    const reservaActualizada = await Reserva.findByIdAndUpdate(
      id,
      { 
        estadoReserva: 'confirmada',
        horaConfirmacion: new Date()
      },
      { new: true }
    )
    .populate('cliente', 'nombre apellido email telefono')
    .populate('mesas', 'numeroMesa capacidad piso sector estado');

    console.log(`✅ Reserva ${id} confirmada exitosamente`);
    return reservaActualizada;
  }

  async cancelarReserva(id) {
    console.log('❌ Cancelando reserva ID:', id);
    
    const reserva = await Reserva.findById(id).populate('mesas');
    if (!reserva || !reserva.activo) {
      throw new Error('Reserva no encontrada');
    }

    // Cambiar estado a cancelada
    const reservaActualizada = await Reserva.findByIdAndUpdate(
      id,
      { 
        estadoReserva: 'cancelada',
        motivoCancelacion: 'Cancelada por el restaurante'
      },
      { new: true }
    )
    .populate('cliente', 'nombre apellido email telefono')
    .populate('mesas', 'numeroMesa capacidad piso sector estado');

    console.log(`✅ Reserva ${id} cancelada exitosamente`);
    return reservaActualizada;
  }

  async verificarReservasProximas() {
    try {
      const ahora = new Date();
      const notificacionesGeneradas = [];

      // Buscar reservas pendientes
      const reservasProximas = await Reserva.find({
        estadoReserva: 'pendiente',
        activo: true
      }).populate('cliente', 'nombre apellido telefono')
        .populate('mesas', 'numeroMesa capacidad piso sector estado');

      for (const reserva of reservasProximas) {
        const fechaHoraReserva = this.combinarFechaYHora(reserva.diaReserva, reserva.horaReserva);
        const diferenciaMs = fechaHoraReserva - ahora;
        const diferenciaMinutos = diferenciaMs / (1000 * 60);
        
        // Si la reserva está entre 10 y 0 minutos antes
        if (diferenciaMinutos <= 10 && diferenciaMinutos >= 0) {
          console.log(`⏰ RESERVA PRÓXIMA: ${reserva.cliente.nombre} - En ${Math.ceil(diferenciaMinutos)} minutos`);
          
          // Generar notificación
          const notificacion = await this.generarNotificacionReservaProxima(reserva);
          if (notificacion) {
            notificacionesGeneradas.push(notificacion);
          }
        }
      }

      return notificacionesGeneradas;
    } catch (error) {
      console.error('Error en verificarReservasProximas:', error);
      return [];
    }
  }

  async verificarReservasVencidas() {
    try {
      const ahora = new Date();
      const hace15Minutos = new Date(ahora.getTime() - (15 * 60 * 1000));
      
      let reservasCanceladas = 0;
      let mesasLiberadas = 0;
      const notificacionesGeneradas = [];

      // Buscar reservas pendientes que ya pasaron su hora + 15 minutos
      const reservasVencidas = await Reserva.find({
        estadoReserva: 'pendiente',
        activo: true
      }).populate('mesas')
        .populate('cliente', 'nombre apellido telefono');

      for (const reserva of reservasVencidas) {
        const fechaHoraReserva = this.combinarFechaYHora(reserva.diaReserva, reserva.horaReserva);
        
        // Si pasaron más de 15 minutos desde la hora de reserva
        if (fechaHoraReserva <= hace15Minutos) {
          // ✅ LIBERAR MESAS antes de cancelar
          for (const mesa of reserva.mesas) {
            await Mesa.findByIdAndUpdate(mesa._id, {
              estado: 'disponible'
            });
            mesasLiberadas++;
            console.log(`✅ Mesa ${mesa.numeroMesa} liberada automáticamente`);
          }

          // Cancelar la reserva
          await Reserva.findByIdAndUpdate(reserva._id, {
            estadoReserva: 'cancelada',
            motivoCancelacion: 'Cancelación automática por no confirmar a tiempo'
          });
          
          // Generar notificación
          const notificacion = await this.generarNotificacionReservaVencida(reserva);
          if (notificacion) {
            notificacionesGeneradas.push(notificacion);
          }
          
          reservasCanceladas++;
          console.log(`🔄 Reserva ${reserva._id} cancelada automáticamente por vencimiento - Mesas liberadas`);
        }
      }

      return { reservasCanceladas, mesasLiberadas, notificacionesGeneradas };
    } catch (error) {
      console.error('Error en verificarReservasVencidas:', error);
      return { reservasCanceladas: 0, mesasLiberadas: 0, notificacionesGeneradas: [] };
    }
  }

  async verificarYActivarReservas() {
    const ahora = new Date();
    
    // Buscar reservas confirmadas que deben activarse (EXACTAMENTE a la hora)
    const reservasParaActivar = await Reserva.find({
      estadoReserva: 'confirmada',
      activo: true
    }).populate('mesas');

    for (const reserva of reservasParaActivar) {
      const fechaHoraReserva = this.combinarFechaYHora(reserva.diaReserva, reserva.horaReserva);
      
      // ✅ ACTIVAR EXACTAMENTE a la hora de la reserva
      if (fechaHoraReserva <= ahora) {
        await this.activarReserva(reserva);
      }
    }
  }

  async verificarYLiberarReservas() {
    const ahora = new Date();
    
    // Buscar reservas en curso que ya pasaron su hora + 2 horas
    const reservasParaLiberar = await Reserva.find({
      estadoReserva: 'en_curso',
      activo: true
    }).populate('mesas');

    for (const reserva of reservasParaLiberar) {
      const fechaHoraReserva = this.combinarFechaYHora(reserva.diaReserva, reserva.horaReserva);
      const dosHorasDespues = new Date(fechaHoraReserva.getTime() + 2 * 60 * 60000);
      
      // Liberar automáticamente después de 2 horas de la reserva
      if (ahora >= dosHorasDespues) {
        await this.liberarMesasDeReserva(reserva._id);
        
        await Reserva.findByIdAndUpdate(reserva._id, {
          estadoReserva: 'finalizada'
        });

        console.log(`🔄 Reserva ${reserva._id} finalizada automáticamente - Mesas liberadas`);
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

      console.log(`✅ Reserva ${reserva._id} activada EXACTAMENTE a su hora - Mesas marcadas como reservadas`);
    } catch (error) {
      console.error(`❌ Error activando reserva ${reserva._id}:`, error);
    }
  }

  // ==================== MÉTODO PARA CONFIRMAR ASISTENCIA Y LIBERAR MESAS ====================

  async confirmarAsistenciaYLiberar(id) {
    console.log('✅ Confirmando asistencia y liberando mesas para reserva ID:', id);
    
    const reserva = await Reserva.findById(id).populate('mesas');
    if (!reserva || !reserva.activo) {
      throw new Error('Reserva no encontrada');
    }

    // Verificar que la reserva esté confirmada
    if (reserva.estadoReserva !== 'confirmada') {
      throw new Error('Solo se puede confirmar asistencia en reservas confirmadas');
    }

    // ✅ LIBERAR MESAS inmediatamente al confirmar asistencia
    for (const mesaId of reserva.mesas) {
      await Mesa.findByIdAndUpdate(mesaId, {
        estado: 'disponible'
      });
    }

    // Cambiar estado a "en_curso" pero mantener activo: true
    const reservaActualizada = await Reserva.findByIdAndUpdate(
      id,
      { 
        estadoReserva: 'finalizada',
        horaInicioReal: new Date(),
        horaFinReal: new Date()       
      },
      { new: true }
    )
    .populate('cliente', 'nombre apellido email telefono')
    .populate('mesas', 'numeroMesa capacidad piso sector estado');

    console.log(`✅ Asistencia confirmada para reserva ${id} - Mesas liberadas`);
    return reservaActualizada;
  }

  // ==================== MÉTODOS CRUD PRINCIPALES ====================

  async getAll() {
    return await Reserva.find({
       activo: true 
    })
    .populate('cliente', 'nombre apellido email telefono')
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

    const mesas = await Mesa.find({ 
      _id: { $in: data.mesas }
    });

    if (mesas.length !== data.mesas.length) {
      throw new Error('Una o más mesas no existen');
    }

    // Validar que las mesas estén disponibles
    const mesasNoDisponibles = mesas.filter(mesa => 
      mesa.estado !== 'disponible' && mesa.estado !== 'liberada'
    );
    if (mesasNoDisponibles.length > 0) {
      throw new Error(`Las mesas ${mesasNoDisponibles.map(m => m.numeroMesa).join(', ')} no están disponibles`);
    }

    // Asegurar que diaReserva sea un objeto Date válido
    let diaReserva;
    if (data.diaReserva instanceof Date) {
      diaReserva = data.diaReserva;
    } else if (typeof data.diaReserva === 'string') {
      diaReserva = new Date(data.diaReserva);
      if (isNaN(diaReserva.getTime())) {
        throw new Error('Fecha de reserva no válida');
      }
    } else {
      throw new Error('Formato de fecha no válido');
    }

    // Verificar disponibilidad
    const disponibles = await this.verificarDisponibilidadMesas(
      diaReserva,
      data.horaReserva,
      data.mesas
    );
    
    if (!disponibles) {
      throw new Error('Una o más mesas están ocupadas en la fecha y hora seleccionadas');
    }

    // ✅ CORRECCIÓN: NO marcar mesas como reservadas al crear la reserva
    // Las mesas permanecen disponibles hasta que llegue la hora exacta

    // Crear la reserva
    const nuevaReserva = new Reserva({
      ...data,
      diaReserva: diaReserva
    });
    
    await nuevaReserva.save();

    return await Reserva.findById(nuevaReserva._id)
      .populate('cliente', 'nombre apellido telefono')
      .populate('mesas', 'numeroMesa capacidad piso sector estado');
  }

  async update(id, data) {
    console.log('🔍 Actualizando reserva ID:', id);

    const reserva = await Reserva.findById(id);
    if (!reserva || !reserva.activo) {
      throw new Error('Reserva no encontrada');
    }

    // Validaciones de cliente y mesas...
    if (data.cliente && data.cliente !== reserva.cliente.toString()) {
      const cliente = await Cliente.findById(data.cliente);
      if (!cliente) {
        throw new Error('Cliente no encontrado');
      }
    }

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
          reserva._id
      );
      if (!disponibles) {
        throw new Error('Una o más mesas están ocupadas en la fecha y hora seleccionadas');
      }
    }

    // Actualizar campos permitidos
    if (data.cliente) reserva.cliente = data.cliente;
    if (data.mesas) reserva.mesas = data.mesas;
    if (data.diaReserva) reserva.diaReserva = data.diaReserva;
    if (data.horaReserva) reserva.horaReserva = data.horaReserva;
    if (data.estadoReserva) reserva.estadoReserva = data.estadoReserva;
    if (data.numeroPersonas !== undefined) reserva.numeroPersonas = data.numeroPersonas;
    if (data.observaciones !== undefined) reserva.observaciones = data.observaciones;

    await reserva.save();

    return await Reserva.findById(reserva._id)
      .populate('cliente', 'nombre email telefono')
      .populate('mesas', 'numeroMesa capacidad piso sector estado');
  }

  async delete(id) {
    console.log('🗑️ Eliminando reserva de la base de datos ID:', id);
    
    const reserva = await Reserva.findById(id);
    if (!reserva) {
      throw new Error('Reserva no encontrada');
    }

    // Liberar mesas antes de eliminar (por si acaso estaban reservadas)
    await this.liberarMesasDeReserva(id);
    
    await Reserva.findByIdAndDelete(id);
    
    console.log('✅ Reserva eliminada permanentemente de la base de datos');
    return { mensaje: 'Reserva eliminada permanentemente' };
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
    .populate('cliente', 'nombre apellido email telefono')
    .populate('mesas', 'numeroMesa capacidad piso sector estado')
    .sort({ horaReserva: 1 });
  }

  async getReservasPorCliente(clienteId) {
    return await Reserva.find({
      cliente: clienteId,
      activo: true
    })
    .populate('cliente', 'nombre apellido email telefono')
    .populate('mesas', 'numeroMesa capacidad piso sector estado')
    .sort({ diaReserva: -1, horaReserva: -1 });
  }

  async getReservasPorEstado(estado) {
    const estadosPermitidos = ['pendiente', 'confirmada', 'cancelada', 'finalizada', 'en_curso'];
    if (!estadosPermitidos.includes(estado)) {
      throw new Error('Estado no válido');
    }

    return await Reserva.find({
      estadoReserva: estado,
      activo: true
    })
    .populate('cliente', 'nombre email telefono')
    .populate('mesas', 'numeroMasa capacidad piso sector estado')
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
    const estadosPermitidos = ['pendiente', 'confirmada', 'cancelada', 'finalizada', 'en_curso'];
    if (!estadosPermitidos.includes(estado)) {
      throw new Error('Estado no válido');
    }

    const reserva = await Reserva.findById(id).populate('mesas');
    if (!reserva || !reserva.activo) {
      throw new Error('Reserva no encontrada');
    }

    // Al cancelar o finalizar, liberar mesas si estaban reservadas
    if ((estado === 'cancelada' || estado === 'finalizada') && 
        reserva.estadoReserva === 'confirmada') {
      await this.liberarMesasDeReserva(id);
    }

    const reservaActualizada = await Reserva.findByIdAndUpdate(
      id,
      { estadoReserva: estado },
      { new: true }
    ).populate('cliente', 'nombre apellido email telefono')
    .populate('mesas', 'numeroMesa capacidad piso sector estado');

    console.log(`🔄 Estado de reserva ${id} cambiado a: ${estado}`);
    return reservaActualizada;
  }

  // ==================== MÉTODOS DE DISPONIBILIDAD ====================

  async verificarDisponibilidadMesas(diaReserva, horaReserva, mesasIds, reservaId = null) {
    try {
      const dia = diaReserva instanceof Date ? diaReserva : new Date(diaReserva);
      
      const filtro = {
        mesas: { $in: mesasIds },
        diaReserva: {
          $gte: new Date(dia.setHours(0, 0, 0, 0)),
          $lte: new Date(dia.setHours(23, 59, 59, 999))
        },
        horaReserva: horaReserva,
        estadoReserva: { $in: ['pendiente', 'confirmada', 'en_curso'] },
        activo: true
      };

      if (reservaId) {
        filtro._id = { $ne: reservaId };
      }

      const reservasExistentes = await Reserva.find(filtro);
      
      console.log(`🔍 Verificación disponibilidad - Mesas: ${mesasIds}, Fecha: ${diaReserva}, Hora: ${horaReserva}`);
      console.log(`📊 Reservas existentes encontradas: ${reservasExistentes.length}`);

      return reservasExistentes.length === 0;
    } catch (error) {
      console.error('❌ Error en verificarDisponibilidadMesas:', error);
      return false;
    }
  }

  async getMesasDisponibles(diaReserva, horaReserva) {
    const dia = new Date(diaReserva);
    
    const reservas = await Reserva.find({
      diaReserva: dia,
      horaReserva: horaReserva,
      estadoReserva: { $in: ['pendiente', 'confirmada', 'en_curso'] },
      activo: true
    });

    const mesasOcupadasIds = reservas.flatMap(reserva => reserva.mesas);
    
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

  // Método para obtener estadísticas
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