const express = require('express');
const router = express.Router();

// Ruta para mostrar la vista de clientes
router.get('/', (req, res) => {
    res.render('clientes',{ usuario: req.user }); // index.ejs de clientes
});

module.exports = router;
