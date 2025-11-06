const express = require('express');
const router = express.Router();
const MesaController = require('../controllers/mesasController');

router.get('/', MesaController.listar);
router.get('/:id', MesaController.obtener);
router.post('/', MesaController.crear);
router.put('/:id', MesaController.actualizar);
router.delete('/:id', MesaController.eliminar);
router.get('/filtrar', MesaController.filtrar);
router.patch('/:id/estado', MesaController.cambiarEstado);
router.get('/conteo/estado', MesaController.contarPorEstado);
router.get('/:id/historial', MesaController.historialMesa);
router.patch('/:id/liberar', MesaController.liberarMesa);

module.exports = router;