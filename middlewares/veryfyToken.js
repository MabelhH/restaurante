const jwt = require('jsonwebtoken');
const SECRET_KEY = 'tu_clave_secreta_aqui';

exports.verifyToken = (req, res, next) => {
  const token = req.cookies.token;
  if (!token) return res.redirect('/login');

  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    req.user = decoded;
    next();
  } catch (err) {
    console.error('Token inválido:', err.message);
    res.redirect('/login');
  }
};
