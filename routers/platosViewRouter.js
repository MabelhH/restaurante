const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
    res.render('platos'); // productos.ejs que crearás
});

module.exports = router;
