const express = require('express');
const router = express.Router();
const pagoController = require('../controllers/pagoController');

// Mostrar todos los pedidos pendientes (vista de pagos)
router.get('/', pagoController.verPagos);

// Registrar un pago
router.post('/pagar/:id', pagoController.pagarPedido);

// Cancelar un pedido
router.post('/cancelar/:id', pagoController.cancelarPedido);

module.exports = router;
