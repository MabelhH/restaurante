const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const verifyToken = require('../middlewares/verifyToken'); // ✅ Importa el middleware

router.get('/login', (req, res) => res.render('login'));
router.post('/login', userController.login);

router.get('/register', (req, res) => res.render('register'));
router.post('/register', userController.register);

// ✅ Protegemos el dashboard con JWT
router.get('/dashboard', verifyToken, userController.dashboard);

module.exports = router;
