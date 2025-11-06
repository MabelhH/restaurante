const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const SECRET_KEY = 'tu_clave_secreta_aqui';

const Plato = require('../models/platosModel');
const Categoria = require('../models/categoriaModel');
const Mesa = require('../models/mesasModel');

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
    console.log('👤 Usuario accediendo a carta:', req.user);

    // Poblar el campo "categoria" para mostrar nombres
    const platos = await Plato.find({ estado: 'activo' })
      .populate('categoria', 'nombre')
      .sort({ nombre: 1 });

    // Obtener todas las categorías
    const categorias = await Categoria.find({ estado: 'activo' }, 'nombre');

    // ✅ Obtener mesas disponibles para el carrito
    const mesas = await Mesa.find({ 
      estado: { $in: ['disponible', 'liberada'] } 
    }).sort({ numeroMesa: 1 });

    console.log('📊 Datos cargados:', {
      platos: platos.length,
      categorias: categorias.length,
      mesas: mesas.length
    });

    // CORREGIDO: Pasar el usuario con _id
    const userData = {
      ...req.user,
      _id: req.user._id || req.user.id // Compatibilidad con ambos
    };

    // Renderizado según el rol del usuario
    if (req.user.rol === 'admin') {
      res.render('carta', { 
        usuario: userData, 
        platos, 
        categorias, 
        mesas 
      });
    } else if (req.user.rol === 'mesero') {
      res.render('cartaM', { 
        usuario: userData, 
        platos, 
        categorias, 
        mesas 
      });
    } else {
      res.status(403).send('Acceso denegado');
    }
  } catch (err) {
    console.error('❌ Error al cargar la carta:', err);
    res.status(500).send('Error al cargar la carta');
  }
});

module.exports = router;