// routers/cartaViewRouter.js
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const SECRET_KEY = 'tu_clave_secreta_aqui';

const Plato = require('../models/platosModel');
const Categoria = require('../models/categoriaModel'); // 👈 Asegúrate de tener este modelo creado

// Middleware para verificar el token
function verifyToken(req, res, next) {
  const token = req.cookies.token;
  if (!token) return res.redirect('/login');

  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    req.user = decoded;
    next();
  } catch (err) {
    res.clearCookie('token');
    return res.redirect('/login');
  }
}

// Ruta /carta (según rol)
router.get('/', verifyToken, async (req, res) => {
  try {
    // ✅ Poblar el campo "categoria" para mostrar nombres en lugar de ObjectIds
    const platos = await Plato.find().populate('categoria', 'nombre');

    // ✅ Obtener todas las categorías (solo el nombre)
    const categorias = await Categoria.find({}, 'nombre');

    // ✅ Renderizado según el rol del usuario
    if (req.user.rol === 'admin') {
      res.render('carta', { usuario: req.user, platos, categorias });
    } else if (req.user.rol === 'mesero') {
      res.render('cartaM', { usuario: req.user, platos, categorias });
    } else {
      res.status(403).send('Acceso denegado');
    }
  } catch (err) {
    console.error('Error al cargar la carta:', err);
    res.status(500).send('Error al cargar la carta');
  }
});

module.exports = router;
