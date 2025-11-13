const express = require('express');
const router = express.Router();
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');

const Pedido = require('../models/pedidosModel');
const Usuario = require('../models/userModel');
const { verifyToken } = require('../controllers/userController');

// =============== RUTA PRINCIPAL ===============
router.get('/', verifyToken, async (req, res) => {
  try {
    const meseros = await Usuario.find({ rol: 'mesero' }).lean();

    res.render('reportes', {
      meseros,
      pedidos: [],
      totalGeneral: 0,
      fechaInicio: '',
      fechaFin: ''
    });
  } catch (error) {
    console.error('Error cargando /reportes:', error);
    res.status(500).send('Error al cargar los reportes');
  }
});

// =============== FILTRAR PEDIDOS (JSON) ===============
router.get('/filtrar', verifyToken, async (req, res) => {
  try {
    const { fechaInicio, fechaFin, mesero } = req.query;

    if (!fechaInicio || !fechaFin) {
      return res.status(400).send('Debe seleccionar un rango de fechas');
    }

    const inicio = new Date(fechaInicio);
    inicio.setHours(0, 0, 0, 0);
    const fin = new Date(fechaFin);
    fin.setHours(23, 59, 59, 999);

    const filtro = { fechaPedido: { $gte: inicio, $lte: fin } };
    if (mesero && mesero !== 'todos') filtro.mesero = mesero;

    const pedidos = await Pedido.find(filtro)
      .populate('mesero', 'nombre apellido')
      .sort({ fechaPedido: -1 })
      .lean();

    const resultados = pedidos.map((p, idx) => ({
      numeroPedido: idx + 1,
      _id: p._id,
      fechaPedido: p.fechaPedido,
      platos: Array.isArray(p.platos)
        ? p.platos.map(pl => ({
            nombre: pl.nombre || 'Sin nombre',
            cantidad: pl.cantidad ?? 0,
            subtotal: pl.subtotal ?? (pl.precio * pl.cantidad || 0),
          }))
        : [],
      total: (p.total || 0).toFixed(2),
      estadoPago: p.estadoPago || p.estadoPedido || 'pendiente',
      mesero: p.mesero ? `${p.mesero.nombre} ${p.mesero.apellido}` : 'Sin asignar',
    }));

    const totalGeneral = pedidos.reduce((sum, p) => sum + (p.total || 0), 0);

    res.json({ resultados, totalGeneral: totalGeneral.toFixed(2) });
  } catch (error) {
    console.error('Error al filtrar pedidos:', error);
    res.status(500).send('Error filtrando pedidos');
  }
});

// =============== PDF ===============
router.get('/pdf_rango', verifyToken, async (req, res) => {
  try {
    const { fechaInicio, fechaFin, mesero } = req.query;
    if (!fechaInicio || !fechaFin) return res.status(400).send('Selecciona un rango de fechas');

    const inicio = new Date(fechaInicio);
    inicio.setHours(0, 0, 0, 0);
    const fin = new Date(fechaFin);
    fin.setHours(23, 59, 59, 999);

    const filtro = { fechaPedido: { $gte: inicio, $lte: fin } };
    if (mesero && mesero !== 'todos') filtro.mesero = mesero;

    const pedidos = await Pedido.find(filtro)
      .populate('mesero', 'nombre apellido')
      .sort({ fechaPedido: -1 })
      .lean();

    if (!pedidos.length) return res.status(404).send('No hay pedidos en el rango seleccionado');

    const totalGeneral = pedidos.reduce((sum, p) => sum + (p.total || 0), 0);

    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="reporte_${fechaInicio}_a_${fechaFin}.pdf"`
    );
    doc.pipe(res);

    // === ENCABEZADO ===
    doc.fontSize(18).text('Reporte de Pedidos', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(12).text(`Desde: ${inicio.toLocaleDateString()}  Hasta: ${fin.toLocaleDateString()}`);
    if (mesero && mesero !== 'todos') {
      const first = pedidos.find(p => p.mesero);
      const nombreMes = first?.mesero
        ? `${first.mesero.nombre} ${first.mesero.apellido}`
        : 'Mesero no encontrado';
      doc.text(`Mesero: ${nombreMes}`);
    } else {
      doc.text('Mesero: Todos');
    }
    doc.moveDown(1);

    // === CONTENIDO ===
    pedidos.forEach((p, idx) => {
      const numero = idx + 1;
      const fecha = new Date(p.fechaPedido).toLocaleDateString();
      const meseroNombre = p.mesero
        ? `${p.mesero.nombre} ${p.mesero.apellido}`
        : 'Sin asignar';
      const total = (p.total || 0).toFixed(2);
      const estado = p.estadoPago || p.estadoPedido || 'pendiente';

      doc.fontSize(12).text(`Pedido N° ${numero}`, { underline: true });
      doc.fontSize(10).text(`Fecha: ${fecha}`);
      doc.text(`Mesero: ${meseroNombre}`);
      doc.text(`Estado: ${estado}`);
      doc.text(`Total: S/ ${total}`);
      doc.moveDown(0.3);

      if (Array.isArray(p.platos) && p.platos.length > 0) {
        doc.text('Platos:');
        p.platos.forEach(pl => {
          const nombre = pl.nombre || 'Desconocido';
          const cantidad = pl.cantidad ?? 0;
          const subtotal = pl.subtotal ?? (pl.precio * pl.cantidad || 0);
          doc.text(`  - ${nombre} (x${cantidad}) - S/ ${subtotal.toFixed(2)}`);
        });
      } else {
        doc.text('Platos: Sin platos');
      }

      doc.moveDown(0.8);
      doc.text('-----------------------------------------------------------');
      doc.moveDown(0.8);
    });

    // === TOTAL GENERAL ===
    doc.fontSize(12).text(`TOTAL GENERAL: S/ ${totalGeneral.toFixed(2)}`, { align: 'right', bold: true });

    doc.end();
  } catch (error) {
    console.error('Error generando PDF:', error);
    res.status(500).send('Error generando PDF');
  }
});

// =============== EXCEL ===============
router.get('/excel_rango', verifyToken, async (req, res) => {
  try {
    const { fechaInicio, fechaFin, mesero } = req.query;
    if (!fechaInicio || !fechaFin) return res.status(400).send('Selecciona un rango de fechas');

    const inicio = new Date(fechaInicio);
    inicio.setHours(0, 0, 0, 0);
    const fin = new Date(fechaFin);
    fin.setHours(23, 59, 59, 999);

    const filtro = { fechaPedido: { $gte: inicio, $lte: fin } };
    if (mesero && mesero !== 'todos') filtro.mesero = mesero;

    const pedidos = await Pedido.find(filtro)
      .populate('mesero', 'nombre apellido')
      .sort({ fechaPedido: -1 })
      .lean();

    if (!pedidos.length) return res.status(404).send('No hay pedidos en el rango seleccionado');

    const totalGeneral = pedidos.reduce((sum, p) => sum + (p.total || 0), 0);

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Pedidos');

    sheet.columns = [
      { header: 'N°', key: 'n', width: 6 },
      { header: 'Fecha', key: 'fecha', width: 15 },
      { header: 'Platos', key: 'platos', width: 60 },
      { header: 'Total (S/)', key: 'total', width: 12 },
      { header: 'Estado', key: 'estado', width: 12 },
      { header: 'Mesero', key: 'mesero', width: 25 },
    ];

    pedidos.forEach((p, idx) => {
      const platosTexto =
        Array.isArray(p.platos) && p.platos.length
          ? p.platos
              .map(pl => {
                const nombre = pl.nombre || 'Desconocido';
                const cantidad = pl.cantidad ?? 0;
                const subtotal = pl.subtotal ?? (pl.precio * pl.cantidad || 0);
                return `${nombre} (x${cantidad}) - S/ ${subtotal.toFixed(2)}`;
              })
              .join('\n')
          : 'Sin platos';

      sheet.addRow({
        n: idx + 1,
        fecha: new Date(p.fechaPedido).toLocaleDateString(),
        platos: platosTexto,
        total: (p.total || 0).toFixed(2),
        estado: p.estadoPago || p.estadoPedido || 'pendiente',
        mesero: p.mesero ? `${p.mesero.nombre} ${p.mesero.apellido}` : 'Sin asignar',
      });
    });

    // Fila de total general
    sheet.addRow({});
    sheet.addRow({
      n: '',
      fecha: '',
      platos: 'TOTAL GENERAL',
      total: totalGeneral.toFixed(2),
      estado: '',
      mesero: ''
    });

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="pedidos_${fechaInicio}_a_${fechaFin}.xlsx"`
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Error generando Excel:', error);
    res.status(500).send('Error generando Excel');
  }
});

module.exports = router;
