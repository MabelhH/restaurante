// controllers/reporteController.js
const PDFDocument = require('pdfkit');
const Pedido = require('../models/pedidosModel');
const moment = require('moment');

exports.generarReportePDF = async (req, res) => {
  try {
    const { fechaInicio, fechaFin } = req.query;

    const inicio = moment(fechaInicio).startOf('day').toDate();
    const fin = moment(fechaFin).endOf('day').toDate();

    const pedidos = await Pedido.find({ fechaPedido: { $gte: inicio, $lte: fin } });

    if (!pedidos.length) {
      // Retornamos error 404 con texto para mostrar mensaje flotante
      return res.status(404).send('❌ No hay pedidos en el rango de fechas.');
    }

    // Generar PDF
    const doc = new PDFDocument({ margin: 50 });

    res.setHeader('Content-Disposition', `attachment; filename="reporte_${fechaInicio}_a_${fechaFin}.pdf"`);
    res.setHeader('Content-Type', 'application/pdf');

    doc.pipe(res);

    doc.fontSize(18).text('Reporte de Ventas por Rango de Fechas', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Desde: ${fechaInicio}  Hasta: ${fechaFin}`);
    doc.moveDown();

    pedidos.forEach((p, i) => {
      doc.fontSize(11).text(
        `${i + 1}. Pedido ${p._id} | Fecha: ${new Date(p.fechaPedido).toLocaleDateString()} | Total: S/ ${(p.total || 0).toFixed(2)}`
      );
    });

    doc.moveDown();
    doc.fontSize(13).text('--- Fin del Reporte ---', { align: 'center' });

    doc.end();
  } catch (err) {
    console.error('Error generando reporte:', err);
    res.status(500).send('Error generando el reporte.');
  }
};
