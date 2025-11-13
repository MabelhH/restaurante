
const express = require('express');
const router = express.Router();
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

const Categoria = require('../models/categoriaModel');
const Platos = require('../models/platosModel');
const Pedido = require('../models/pedidosModel');
const Reserva = require('../models/reservaModel');
const Cliente = require('../models/clienteModel');
const Mesa = require('../models/mesasModel');

// 🧩 Formatear fechas
function formatFecha(fecha) {
  return fecha.toLocaleString('es-PE', { timeZone: 'America/Lima' });
}

// 🧩 Pedidos del día
async function obtenerPedidosDeHoy() {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const manana = new Date(hoy);
  manana.setDate(hoy.getDate() + 1);

  return await Pedido.find({
    fechaPedido: { $gte: hoy, $lt: manana }
  }).populate('mesa').populate('mesero').populate('platos.plato');
}

// 🧩 Generar resumen para MeseroIA
async function generarResumenMesero() {
  const [platos, pedidosHoy, mesas, reservas, clientes, categorias] = await Promise.all([
    Platos.find({ disponible: true }).populate('categoria'),
    obtenerPedidosDeHoy(),
    Mesa.find(),
    Reserva.find({ activo: true }).populate('cliente').populate('mesas'),
    Cliente.find({ activo: true }),
    Categoria.find({ estado: "activo" }).sort({ orden: 1 })
  ]);

  const resumen = [];
  resumen.push(`PLATOS (${platos.length}):`);
  platos.forEach(p => resumen.push(`- ${p.nombre} (${p.categoria?.nombre || 'sin categoría'}) - S/.${p.precio} - Stock: ${p.stock}`));

  resumen.push(`\nPEDIDOS HOY (${pedidosHoy.length}):`);
  pedidosHoy.forEach((p, i) => {
    resumen.push(
      `#${i + 1}: Mesa ${p.mesa?.numeroMesa || 'N/A'}, Total: S/.${p.total}, Estado: ${p.estadoPedido}, Pago: ${p.estadoPago || 'pendiente'}, Platos: ${p.platos.map(pl => `${pl.nombre} x${pl.cantidad}`).join(', ')}, Fecha: ${formatFecha(p.fechaPedido)}`
    );
  });
  
  resumen.push(`\nMESAS (${mesas.length}):`);
  mesas.forEach(m => resumen.push(`- Mesa ${m.numeroMesa}: ${m.estado}, Capacidad ${m.capacidad}, ${m.piso} - ${m.sector}`));

  resumen.push(`\nRESERVAS (${reservas.length}):`);
  reservas.forEach(r => resumen.push(`- Reserva para ${r.cliente?.nombre || 'N/A'} - Mesas: ${r.mesas.map(m => m.numeroMesa).join(', ')}`));

  resumen.push(`\nCLIENTES (${clientes.length}):`);
  clientes.forEach(c => resumen.push(`- ${c.nombre}`));

  resumen.push(`\nCATEGORÍAS (${categorias.length}): ${categorias.map(c => c.nombre).join(', ')}`);

  return resumen.join('\n');
}

// 🧩 Vista del chat del mesero
router.get("/chat", (req, res) => {
  const meseroName = req.session.userName || "Mesero";
  res.render("chatM", { meseroName });
});

// 🧩 Respuesta de MeseroIA
router.post("/chat", async (req, res) => {
  const { message, name } = req.body;

  try {
    const resumen = await generarResumenMesero();

    const prompt = `
Eres **MeseroIA**, un asistente experto del restaurante.
Debes responder con base en los datos reales que te proporciono a continuación. 
Debes aceptar errores de tipeo o variantes de palabras (como "listps" por "listos") y siempre contestar inteligentemente.

=== DATOS REALES DEL RESTAURANTE ===
${resumen}
=== FIN DE DATOS ===

Usuario: ${message}
MeseroIA:
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
      return res.json({ reply: 'Error al comunicarse con MeseroIA.' });
    }

    const data = await response.json();
    const reply = data.response?.trim() || 'No se obtuvo respuesta de MeseroIA.';
    res.json({ reply });

  } catch (error) {
    console.error('Error en MeseroIA:', error);
    res.status(500).json({ reply: `Error al procesar tu mensaje ${name}.` });
  }
});

router.get('/messages', async (req, res) => {
  res.json([]);
});

module.exports = router;
