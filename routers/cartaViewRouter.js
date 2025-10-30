const express = require('express');
const router = express.Router();
const Plato = require('../models/platosModel');

// Ruta /carta
router.get('/', async (req, res) => {
  try {
    const platos = await Plato.find();
    const categorias = await Plato.distinct('categoria'); // 🔹 Trae las categorías únicas

    res.render('carta', { platos, categorias });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error al cargar la carta');
  }
});

module.exports = router;
