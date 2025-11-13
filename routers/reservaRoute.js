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

// Rutas de gestión de estado
router.patch('/:id/estado', ReservaController.cambiarEstado);

// Rutas CRUD generales
router.get('/', ReservaController.listar);
router.get('/:id', ReservaController.obtener);
router.post('/', ReservaController.crear);
router.put('/:id', ReservaController.actualizar);
router.delete('/:id', ReservaController.eliminar);

module.exports = router;