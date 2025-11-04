const Pedido = require('../models/pedidosModel');

// Mostrar los pedidos pendientes (para pagar)
exports.verPagos = async (req, res) => {
  try {
    const pedidos = await Pedido.find({ estado: 'pendiente' })
      .populate('mesa', 'numeroMesa') // solo traer el número de la mesa
      .populate('platos.producto', 'nombre precio'); // populate dentro del array de platos

    res.render('pagos', { pedidos });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error al cargar los pedidos pendientes');
  }
};


// Registrar un pago
exports.pagarPedido = async (req, res) => {
  try {
    const pedido = await Pedido.findById(req.params.id);
    if (!pedido) return res.status(404).send('Pedido no encontrado');

    pedido.estado = 'pagado';
    await pedido.save();

    res.redirect('/pagos');
  } catch (err) {
    res.status(500).send('Error al registrar el pago');
  }
};

// Cancelar pedido
exports.cancelarPedido = async (req, res) => {
  try {
    const pedido = await Pedido.findById(req.params.id);
    if (!pedido) return res.status(404).send('Pedido no encontrado');

    pedido.estado = 'cancelado';
    await pedido.save();

    res.redirect('/pagos');
  } catch (err) {
    res.status(500).send('Error al cancelar el pedido');
  }
};
