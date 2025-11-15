const express = require('express');
const router = express.Router();
const ReservaController = require('../controllers/ReservaController'); // ✅ Corregido: con mayúscula

// Rutas de reportes
router.get('/reportes/estadisticas', ReservaController.estadisticas);
router.get('/reportes/reservas-hoy', ReservaController.reservasHoy);
router.get('/reportes/reservas-pendientes', ReservaController.reservasPendientes);

// Rutas específicas
router.get('/fecha/rango', ReservaController.reservasPorRango);
router.get('/fecha/:fecha', ReservaController.reservasPorFecha);
router.get('/cliente/:clienteId', ReservaController.reservasPorClienteId);
router.get('/mesa/:mesaId', ReservaController.reservasPorMesaId);
router.post('/verificar-disponibilidad', ReservaController.verificarDisponibilidad);

// ✅ Ruta para confirmar asistencia - CORREGIDA
router.post('/:id/confirmar-asistencia', ReservaController.confirmarAsistenciaYLiberar);

router.patch('/:id/confirmar', ReservaController.confirmarReserva);
router.patch('/:id/cancelar', ReservaController.cancelarReserva);


router.get('/notificaciones/todas', ReservaController.obtenerNotificaciones);
router.get('/notificaciones/verificar-proximas', ReservaController.verificarReservasProximas);
router.patch('/notificaciones/:id/leer', ReservaController.marcarNotificacionLeida);

// Ruta temporal para testing
router.get('/notificaciones/prueba', async (req, res) => {
  try {
    const notificacion = await reservaService.crearNotificacionPrueba();
    res.json({
      success: true,
      mensaje: 'Notificación de prueba creada',
      data: notificacion
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      mensaje: error.message
    });
  }
});

// Rutas de gestión de estado
router.patch('/:id/estado', ReservaController.cambiarEstado);

// Rutas CRUD generales
router.get('/', ReservaController.listar);
router.get('/:id', ReservaController.obtener);
router.post('/', ReservaController.crear);
router.put('/:id', ReservaController.actualizar);
router.delete('/:id', ReservaController.eliminar);

module.exports = router;