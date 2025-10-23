// userController.js o authMiddleware.js
const jwt = require('jsonwebtoken');
const SECRET_KEY = 'tu_clave_secreta_aqui'; // mejor en .env

exports.verifyToken = (req, res, next) => {
  const token = req.cookies.token; // token desde cookie
  if (!token) return res.redirect('/login');

  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    req.user = decoded; // datos del usuario logueado
    next();
  } catch (err) {
    console.error('Token inválido:', err.message);
    res.redirect('/login');
  }
};
