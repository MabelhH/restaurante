// routers/reservaRoute.js
const express = require('express');
const router = express.Router();
const reservaController = require('../controllers/ReservaController');

router.get('/', reservaController.listar);
router.get('/:id', reservaController.obtener);
router.post('/', reservaController.crear);
router.put('/:id', reservaController.actualizar);
router.delete('/:id', reservaController.eliminar);

// Rutas específicas
router.patch('/:id/estado', reservaController.cambiarEstado);
router.get('/fecha/rango', reservaController.reservasPorRango);
router.post('/verificar-disponibilidad', reservaController.verificarDisponibilidad);


module.exports = router;