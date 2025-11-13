const PDFDocument = require('pdfkit');
const Pedido = require('../models/pedidosModel');
const moment = require('moment');
const ExcelJS = require('exceljs');

// 🔹 Vista web
exports.mostrarReportes = async (req, res) => {
  try {
    const { fechaInicio, fechaFin } = req.query;

    if (!fechaInicio || !fechaFin) {
      return res.render('reportes', { pedidos: [], totalGeneral: 0, fechaInicio, fechaFin });
    }

    const inicio = moment(fechaInicio).startOf('day').toDate();
    const fin = moment(fechaFin).endOf('day').toDate();

    const pedidos = await Pedido.find({ fechaPedido: { $gte: inicio, $lte: fin } });

    const totalGeneral = pedidos.reduce((sum, p) => sum + (p.total || 0), 0);

    res.render('reportes', { pedidos, totalGeneral, fechaInicio, fechaFin });
  } catch (err) {
    console.error('Error mostrando reportes:', err);
    res.status(500).send('Error mostrando los reportes.');
  }
};

// 🔹 Generar PDF
exports.generarReportePDF = async (req, res) => {
  try {
    const { fechaInicio, fechaFin } = req.query;
    const inicio = moment(fechaInicio).startOf('day').toDate();
    const fin = moment(fechaFin).endOf('day').toDate();

    const pedidos = await Pedido.find({ fechaPedido: { $gte: inicio, $lte: fin } });
    if (!pedidos.length) return res.status(404).send('❌ No hay pedidos en el rango de fechas.');

    const totalGeneral = pedidos.reduce((sum, p) => sum + (p.total || 0), 0);

    const doc = new PDFDocument({ margin: 50 });
    res.setHeader('Content-Disposition', `attachment; filename="reporte_${fechaInicio}_a_${fechaFin}.pdf"`);
    res.setHeader('Content-Type', 'application/pdf');
    doc.pipe(res);

    doc.fontSize(18).text('📊 Reporte de Ventas', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Desde: ${fechaInicio}  Hasta: ${fechaFin}`);
    doc.moveDown();

    pedidos.forEach((p, i) => {
      doc.fontSize(11).text(
        `${i + 1}. Pedido ${p._id} | Fecha: ${new Date(p.fechaPedido).toLocaleDateString()} | Total: S/ ${(p.total || 0).toFixed(2)}`
      );
    });

    doc.moveDown();
    doc.fontSize(13).text('--------------------------------------', { align: 'center' });
    doc.fontSize(14).text(`TOTAL GENERAL: S/ ${totalGeneral.toFixed(2)}`, { align: 'center', bold: true });
    doc.moveDown();
    doc.fontSize(12).text('--- Fin del Reporte ---', { align: 'center' });

    doc.end();
  } catch (err) {
    console.error('Error generando PDF:', err);
    res.status(500).send('Error generando el reporte PDF.');
  }
};

// 🔹 Generar Excel
exports.generarReporteExcel = async (req, res) => {
  try {
    const { fechaInicio, fechaFin } = req.query;
    const inicio = moment(fechaInicio).startOf('day').toDate();
    const fin = moment(fechaFin).endOf('day').toDate();

    const pedidos = await Pedido.find({ fechaPedido: { $gte: inicio, $lte: fin } });
    if (!pedidos.length) return res.status(404).send('❌ No hay pedidos en el rango de fechas.');

    const totalGeneral = pedidos.reduce((sum, p) => sum + (p.total || 0), 0);

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Reporte de Ventas');

    worksheet.columns = [
      { header: 'N°', key: 'numero', width: 10 },
      { header: 'ID Pedido', key: 'id', width: 30 },
      { header: 'Fecha Pedido', key: 'fecha', width: 20 },
      { header: 'Total (S/)', key: 'total', width: 15 },
    ];

    pedidos.forEach((p, i) => {
      worksheet.addRow({
        numero: i + 1,
        id: p._id.toString(),
        fecha: new Date(p.fechaPedido).toLocaleDateString(),
        total: (p.total || 0).toFixed(2),
      });
    });

    worksheet.addRow({});
    worksheet.addRow({ id: 'TOTAL GENERAL', total: totalGeneral.toFixed(2) });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=reporte_${fechaInicio}_a_${fechaFin}.xlsx`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('Error generando Excel:', err);
    res.status(500).send('Error generando el reporte Excel.');
  }
};
