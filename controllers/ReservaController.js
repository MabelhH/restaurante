// controllers/ReservaController.js
const ReservaService = require('../services/reservaService');
const Reserva = require('../models/reservaModel');
const reservaService = new ReservaService();

class ReservaController {
  // Obtener todas las reservas
  async listar(req, res) {
    try {
      const { fecha, cliente, estado, fechaInicio, fechaFin } = req.query;
      
      let reservas;
      
      // Prioridad: rango de fechas
      if (fechaInicio && fechaFin) {
        reservas = await reservaService.getReservasPorRango(fechaInicio, fechaFin);
      } 
      // Luego filtros individuales
      else if (fecha) {
        reservas = await reservaService.getReservasPorFecha(fecha);
      } else if (cliente) {
        reservas = await reservaService.getReservasPorCliente(cliente);
      } else if (estado) {
        reservas = await reservaService.getReservasPorEstado(estado);
      } else {
        reservas = await reservaService.getAll();
      }
      
      res.json({
        success: true,
        data: reservas,
        total: reservas.length
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        mensaje: 'Error al obtener reservas',
        error: error.message
      });
    }
  }
  // Obtener una reserva por ID
  // controllers/ReservaController.js
  async  obtener(req, res) {
    try {
      const reserva = await Reserva.findById(req.params.id)
      .populate('cliente', 'nombre apellido telefono email')
      .populate('mesas', 'numeroMesa capacidad piso sector estado');
      
      console.log('📋 Reserva encontrada:', reserva);
      console.log('🪑 Mesas en la reserva:', reserva?.mesas);// <- importante
      if (!reserva) return res.status(404).json({ mensaje: 'Reserva no encontrada' });
      res.json(reserva);
    } catch (error) {
      console.error(error);
      res.status(500).json({ mensaje: 'Error al obtener la reserva' });
    }
  }


  // Crear nueva reserva
  async crear(req, res) {
    try {
      console.log('📝 Datos recibidos en reserva:', req.body);
      
      // Validación más robusta
      const { diaReserva, mesas, cliente, horaReserva } = req.body;
      
      if (!diaReserva || !mesas || !cliente || !horaReserva) {
        return res.status(400).json({
          success: false,
          mensaje: 'Faltan campos obligatorios: diaReserva, mesas, cliente, horaReserva'
        });
      }

      const reservaData = {
        ...req.body,
        diaReserva: new Date(diaReserva),
        numeroPersonas: parseInt(req.body.numeroPersonas) || 1,
        observaciones: req.body.observaciones || '',
        estadoReserva: req.body.estadoReserva || 'pendiente'
      };

      const nuevaReserva = await reservaService.create(reservaData);
      
      res.status(201).json({
        success: true,
        mensaje: 'Reserva creada exitosamente',
        data: nuevaReserva
      });
    } catch (error) {
      console.error('Error en crear reserva:', error);
      res.status(400).json({
        success: false,
        mensaje: error.message
      });
    }
  }

  

  // Actualizar reserva - VERSIÓN CORREGIDA USANDO EL SERVICIO
  async actualizar(req, res) {
    try {
      const { id } = req.params;
      console.log('🔧 PUT /api/reservas/:id', id, req.body);

      // Procesar los datos de la reserva
      const reservaData = {
        ...req.body
      };

      // Convertir fecha si existe
      if (req.body.diaReserva) {
        reservaData.diaReserva = new Date(req.body.diaReserva);
      }

      // Convertir número de personas si existe
      if (req.body.numeroPersonas) {
        reservaData.numeroPersonas = parseInt(req.body.numeroPersonas);
      }

      // Si mesas es un array de objetos, extraer solo los IDs
      if (reservaData.mesas && Array.isArray(reservaData.mesas)) {
        reservaData.mesas = reservaData.mesas.map(mesa => 
          typeof mesa === 'object' ? mesa._id : mesa
        );
      }

      console.log('📤 Datos procesados para actualizar:', reservaData);

      // USAR EL SERVICIO EN LUGAR DEL MODELO DIRECTAMENTE
      const reservaActualizada = await reservaService.update(id, reservaData);

      res.json({ 
        success: true, 
        data: reservaActualizada,
        mensaje: 'Reserva actualizada correctamente'
      });
    } catch (err) {
      console.error('❌ Error al actualizar reserva:', err);
      res.status(500).json({ 
        success: false,
        mensaje: err.message || 'Error al actualizar la reserva' 
      });
    }
  }

  // Eliminar reserva (soft delete)
  // En tu ReservaController.js - método eliminar
  async eliminar(req, res) {
      try {
          console.log('🗑️ SOLICITUD DE ELIMINAR RESERVA ID:', req.params.id);

          const resultado = await reservaService.delete(req.params.id);

          if (!resultado) {
              console.log('❌ Reserva no encontrada para eliminar');
              return res.status(404).json({
                  success: false,
                  mensaje: 'Reserva no encontrada'
              });
          }

          console.log('✅ Reserva eliminada correctamente');
          res.json({
              success: true,
              mensaje: 'Reserva eliminada correctamente'
          });
      } catch (error) {
          console.error('❌ Error al eliminar reserva:', error);
          res.status(500).json({
              success: false,
              mensaje: error.message || 'Error al eliminar reserva'
          });
      }
  }

  async confirmarReserva(req, res) {
    try {
      const { id } = req.params;
      console.log('✅ Confirmando reserva ID:', id);
      
      const reservaActualizada = await reservaService.confirmarReserva(id);
      
      res.json({
        success: true,
        data: reservaActualizada,
        mensaje: 'Reserva confirmada exitosamente'
      });
    } catch (error) {
      console.error('❌ Error en confirmarReserva:', error);
      res.status(400).json({
        success: false,
        mensaje: error.message
      });
    }
  }

  async cancelarReserva(req, res) {
    try {
      const { id } = req.params;
      console.log('❌ Cancelando reserva ID:', id);
      
      const reservaActualizada = await reservaService.cancelarReserva(id);
      
      res.json({
        success: true,
        data: reservaActualizada,
        mensaje: 'Reserva cancelada exitosamente'
      });
    } catch (error) {
      console.error('❌ Error en cancelarReserva:', error);
      res.status(400).json({
        success: false,
        mensaje: error.message
      });
    }
  }

  // En tu ReservaController.js - método obtenerNotificaciones
  async obtenerNotificaciones(req, res) {
    try {
      console.log('🔔 Solicitando notificaciones...');
      
      // ✅ USAR EL MÉTODO CORREGIDO
      const notificaciones = reservaService.getTodasLasNotificaciones();
      
      console.log(`📋 Notificaciones encontradas: ${notificaciones.length}`);
      
      res.json({
        success: true,
        data: notificaciones,
        total: notificaciones.length
      });
    } catch (error) {
      console.error('❌ Error al obtener notificaciones:', error);
      res.status(500).json({
        success: false,
        mensaje: 'Error interno del servidor al obtener notificaciones',
        error: error.message,
        data: [] // ✅ ENVIAR ARRAY VACÍO EN CASO DE ERROR
      });
    }
  }

  // Método para obtener notificaciones no leídas específicamente
  async obtenerNotificacionesNoLeidas(req, res) {
    try {
      const notificaciones = reservaService.getNotificacionesNoLeidas();
      
      res.json({
        success: true,
        data: notificaciones,
        total: notificaciones.length
      });
    } catch (error) {
      console.error('❌ Error al obtener notificaciones no leídas:', error);
      res.status(500).json({
        success: false,
        mensaje: error.message,
        data: []
      });
    }
  }

  async marcarNotificacionLeida(req, res) {
    try {
      const { id } = req.params;
      reservaService.marcarNotificacionLeida(id);
      
      res.json({
        success: true,
        mensaje: 'Notificación marcada como leída'
      });
    } catch (error) {
      console.error('❌ Error al marcar notificación:', error);
      res.status(500).json({
        success: false,
        mensaje: error.message
      });
    }
  }

  async verificarReservasProximas(req, res) {
    try {
      const notificaciones = await reservaService.verificarReservasProximas();
      
      res.json({
        success: true,
        data: notificaciones,
        total: notificaciones.length,
        mensaje: `${notificaciones.length} notificaciones generadas`
      });
    } catch (error) {
      console.error('❌ Error en verificarReservasProximas:', error);
      res.status(500).json({
        success: false,
        mensaje: error.message
      });
    }
  }


  // Cambiar estado de reserva
  async cambiarEstado(req, res) {
    try {
      const { estado } = req.body;
      const reservaActualizada = await reservaService.cambiarEstado(req.params.id, estado);
      
      res.json({
        success: true,
        mensaje: `Reserva ${estado} exitosamente`,
        data: reservaActualizada
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        mensaje: error.message
      });
    }
  }

  // Obtener reservas por rango de fechas
  async reservasPorRango(req, res) {
    try {
      const { fechaInicio, fechaFin } = req.query;
      
      if (!fechaInicio || !fechaFin) {
        return res.status(400).json({
          success: false,
          mensaje: 'fechaInicio y fechaFin son requeridos'
        });
      }

      const reservas = await reservaService.getReservasPorRango(fechaInicio, fechaFin);
      
      res.json({
        success: true,
        data: reservas,
        total: reservas.length
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        mensaje: 'Error al obtener reservas',
        error: error.message
      });
    }
  }

  // Obtener disponibilidad de mesas
  async verificarDisponibilidad(req, res) {
    try {
      const { diaReserva, horaReserva, mesas } = req.body;
      
      if (!diaReserva || !horaReserva) {
        return res.status(400).json({
          success: false,
          mensaje: 'diaReserva y horaReserva son requeridos'
        });
      }

      const disponible = await reservaService.verificarDisponibilidadMesas(
        diaReserva, 
        horaReserva, 
        mesas
      );

      res.json({
        success: true,
        data: { disponible },
        mensaje: disponible ? 
          'Mesas disponibles' : 
          'Una o más mesas no están disponibles en esa fecha y hora'
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        mensaje: error.message
      });
    }
  }
  // Agregar al controlador
  async estadisticas(req, res) {
    try {
      const stats = await reservaService.getEstadisticas();
      
      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        mensaje: 'Error al obtener estadísticas',
        error: error.message
      });
    }
  }
  // Agregar a tu ReservaController.js

  // 📅 Reservas de hoy
  async reservasHoy(req, res) {
    try {
      const hoy = new Date().toISOString().split('T')[0];
      const reservas = await reservaService.getReservasPorFecha(hoy);
      res.json({
        success: true,
        data: reservas,
        total: reservas.length
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        mensaje: 'Error al obtener reservas de hoy',
        error: error.message
      });
    }
  }

  // ⏳ Reservas pendientes
  async reservasPendientes(req, res) {
    try {
      const reservas = await reservaService.getReservasPorEstado('pendiente');
      res.json({
        success: true,
        data: reservas,
        total: reservas.length
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        mensaje: 'Error al obtener reservas pendientes',
        error: error.message
      });
    }
  }

  // 👤 Reservas por cliente (ID específico)
  async reservasPorClienteId(req, res) {
    try {
      const { clienteId } = req.params;
      const reservas = await reservaService.getReservasPorCliente(clienteId);
      res.json({
        success: true,
        data: reservas,
        total: reservas.length
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        mensaje: 'Error al obtener reservas del cliente',
        error: error.message
      });
    }
  }

  // 🪑 Reservas por mesa específica
  async reservasPorMesaId(req, res) {
    try {
      const { mesaId } = req.params;
      // Necesitarías agregar este método al servicio
      const reservas = await reservaService.getReservasPorMesa(mesaId);
      res.json({
        success: true,
        data: reservas,
        total: reservas.length
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        mensaje: 'Error al obtener reservas de la mesa',
        error: error.message
      });
    }
  }

  async confirmarAsistenciaYLiberar(req, res) {
    try {
      const { id } = req.params;
      console.log('✅ Confirmando asistencia y liberando mesas para reserva ID:', id);
      
      const reservaActualizada = await reservaService.confirmarAsistenciaYLiberar(id);
      
      res.json({
        success: true,
        data: reservaActualizada,
        mensaje: 'Asistencia confirmada y mesas liberadas exitosamente'
      });
    } catch (error) {
      console.error('❌ Error en confirmarAsistenciaYLiberar:', error);
      res.status(400).json({
        success: false,
        mensaje: error.message
      });
    }
  }

  

  // 📅 Reservas por fecha específica
  async reservasPorFecha(req, res) {
    try {
      const { fecha } = req.params;
      const reservas = await reservaService.getReservasPorFecha(fecha);
      res.json({
        success: true,
        data: reservas,
        total: reservas.length
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        mensaje: 'Error al obtener reservas de la fecha',
        error: error.message
      });
    }
  }
}

module.exports = new ReservaController();