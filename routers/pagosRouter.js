// routers/pagosRouter.js
const express = require('express');
const router = express.Router();
const PagosController = require('../controllers/pagosController');

// Mostrar pedidos pendientes de pago (API)
router.get('/', PagosController.verPagos);

// Registrar pago completo
router.post('/pagar/:id', PagosController.pagarPedido);

// Pago parcial
router.post('/pago-parcial/:id', PagosController.pagoParcial);

// Cancelar pedido
router.post('/cancelar/:id', PagosController.cancelarPedido);

// Obtener historial de pagos de un pedido
router.get('/historial/:id', PagosController.historialPagos);

module.exports = router;