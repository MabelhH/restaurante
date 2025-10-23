const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
    res.render('ventas'); // ventas.ejs que crearás
});

module.exports = router;
