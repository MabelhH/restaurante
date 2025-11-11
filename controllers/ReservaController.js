// controllers/ReservaController.js
const ReservaService = require('../services/reservaService');
const Reserva = require('../models/reservaModel');
const reservaService = new ReservaService();

class ReservaController {
  // Obtener todas las reservas
  async listar(req, res) {
    try {
      const { fecha, cliente, estado } = req.query;
      
      let reservas;
      if (fecha) {
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
  async obtener(req, res) {
    try {
      const reserva = await reservaService.getById(req.params.id);
      res.json({
        success: true,
        data: reserva
      });
    } catch (error) {
      res.status(404).json({
        success: false,
        mensaje: error.message
      });
    }
  }

  // Crear nueva reserva
  async crear(req, res) {
    try {
      console.log('📝 Datos recibidos en reserva:', req.body);
      
      const reservaData = {
        ...req.body,
        diaReserva: new Date(req.body.diaReserva),
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
  async eliminar(req, res) {
    try {
      await reservaService.delete(req.params.id);
      res.json({
        success: true,
        mensaje: 'Reserva eliminada correctamente'
      });
    } catch (error) {
      res.status(404).json({
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
}

module.exports = new ReservaController();