const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const SECRET_KEY = 'tu_clave_secreta_aqui';

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

// Ruta principal de platos
router.get('/', verifyToken, (req, res) => {
  // CORREGIDO: Pasar el usuario con _id
  const userData = {
    ...req.user,
    _id: req.user._id || req.user.id // Compatibilidad con ambos
  };

  if (req.user.rol === 'admin') {
    res.render('platos', { usuario: userData });
  }else if (req.user.rol === 'cocinero') {
    res.render('platosc', { usuario: userData });
  } else {
    res.status(403).send('Acceso denegado');
  }
});

module.exports = router;