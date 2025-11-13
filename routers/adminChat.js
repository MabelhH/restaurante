const express = require('express');
const router = express.Router();
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

// ✅ Importar todos los modelos
const Pedido = require('../models/pedidosModel');
const Platos = require('../models/platosModel');
const Usuario = require('../models/userModel');
const Mesa = require('../models/mesasModel');
const Cliente = require('../models/clienteModel');
const Reserva = require('../models/reservaModel');
const Pago = require('../models/pagoModel');
const Categoria = require('../models/categoriaModel');

// 🧩 Función utilitaria para formatear fecha
function formatFecha(fecha) {
  return fecha.toLocaleString('es-PE', { timeZone: 'America/Lima' });
}

// 🧩 Obtener pedidos del día actual
async function obtenerPedidosDeHoy() {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const mañana = new Date(hoy);
  mañana.setDate(hoy.getDate() + 1);

  return await Pedido.find({
    fechaPedido: { $gte: hoy, $lt: mañana }
  }).populate('mesa').populate('mesero').populate('platos.plato');
}

// 🧩 Generar resumen del restaurante
async function generarResumenRestaurante() {
  const [
    platos,
    pedidosHoy,
    usuarios,
    mesas,
    reservas,
    pagos,
    categorias,
    clientes
  ] = await Promise.all([
    Platos.find().populate('categoria'),
    obtenerPedidosDeHoy(),
    Usuario.find(),
    Mesa.find(),
    Reserva.find(),
    Pago.find(),
    Categoria.find(),
    Cliente.find()
  ]);

  const totalRecaudadoHoy = pedidosHoy
    .filter(p => p.estadoPago === 'pagado')
    .reduce((sum, p) => sum + p.total, 0);

  const resumen = [];

  resumen.push(` PLATOS (${platos.length}):`);
  platos.forEach(p => {
    resumen.push(`- ${p.nombre} (${p.descripcion || 'sin descripción'}) - S/.${p.precio.toFixed(2)}`);
  });

  resumen.push(`\n PEDIDOS HOY (${pedidosHoy.length}):`);
  pedidosHoy.forEach((p, i) => {
    resumen.push(
      `#${i + 1}: Mesa ${p.mesa?.numeroMesa || 'N/A'}, Total: S/.${p.total.toFixed(2)}, Estado: ${p.estadoPedido}, Mesero: ${p.mesero?.nombre || 'N/A'}, Platos: ${p.platos.map(pl => `${pl.nombre} x${pl.cantidad}`).join(', ')}, Fecha: ${formatFecha(p.fechaPedido)}`
    );
  });

  resumen.push(`\n USUARIOS (${usuarios.length}):`);
  usuarios.forEach(u => resumen.push(`- ${u.nombre} ${u.apellido} (${u.rol})`));

  resumen.push(`\n MESAS (${mesas.length}):`);
  mesas.forEach(m => resumen.push(`- Mesa ${m.numeroMesa}: ${m.estado}, Capacidad ${m.capacidad}, ${m.piso} - ${m.sector}`));

  resumen.push(`\nTOTAL RECAUDADO HOY: S/. ${totalRecaudadoHoy.toFixed(2)}`);
  resumen.push(`CLIENTES registrados: ${clientes.length}`);
  resumen.push(`RESERVAS registradas: ${reservas.length}`);
  resumen.push(`CATEGORÍAS: ${categorias.map(c => c.nombre).join(', ')}`);

  return resumen.join('\n');
}

// 🧠 Ruta principal del chat con ChefIA
router.post('/chat', async (req, res) => {
  const { message } = req.body;

  try {
    const resumen = await generarResumenRestaurante();

    const prompt = `
Eres **ChefIA**, un asistente experto del restaurante. 
Debes responder con base en los datos reales que te proporciono a continuación.

=== DATOS REALES DEL RESTAURANTE ===
${resumen}
=== FIN DE DATOS ===

Usuario: ${message}
ChefIA:
`;

    // Llamada al modelo Ollama (Llama3)
    const response = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama3:latest',
        prompt,
        stream: false,
      }),
    });

    if (!response.ok) {
      console.error('Error en Ollama:', await response.text());
      return res.json({ reply: 'Error al comunicarse con ChefIA.' });
    }

    const data = await response.json();
    const reply = data.response?.trim() || 'No se obtuvo respuesta de ChefIA.';
    res.json({ reply });

  } catch (error) {
    console.error('Error en ChefIA:', error);
    res.status(500).json({ error: 'Error en el servidor de ChefIA.' });
  }
});

router.get('/messages', async (req, res) => {
  res.json([]);
});

module.exports = router;