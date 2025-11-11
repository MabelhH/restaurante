const express = require('express');
const router = express.Router();
const reservaController = require('../controllers/ReservaController');

router.get('/reportes/estadisticas', reservaController.estadisticas);
router.get('/reportes/reservas-hoy', reservaController.reservasHoy);
router.get('/reportes/reservas-pendientes', reservaController.reservasPendientes);

// Rutas específicas primero
router.get('/fecha/rango', reservaController.reservasPorRango);
router.get('/fecha/:fecha', reservaController.reservasPorFecha);
router.get('/cliente/:clienteId', reservaController.reservasPorClienteId);
router.get('/mesa/:mesaId', reservaController.reservasPorMesaId);
router.post('/verificar-disponibilidad', reservaController.verificarDisponibilidad);

router.patch('/:id/estado', reservaController.cambiarEstado);
// Rutas CRUD generales
router.get('/', reservaController.listar);          // Con filtros múltiples
router.get('/:id', reservaController.obtener);      // Por ID específico
router.post('/', reservaController.crear);          // Crear nueva
router.put('/:id', reservaController.actualizar);   // Actualizar
router.delete('/:id', reservaController.eliminar);  // Eliminar

module.exports = router;
