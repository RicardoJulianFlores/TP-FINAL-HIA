const Pedido = require('../models/pedido.models');
const PagoMercadoPago = require('../models/pago.models');
const pagoCtrl = {};

pagoCtrl.registrarPago = async (req, res) => {
    const { pedidoId, mp_payment_id, estado_pago } = req.body || {}; 
    
    if (!pedidoId || !mp_payment_id) {
        console.log('[BACKEND] Error: Petición de pago recibida con datos insuficientes.', req.body);
        return res.status(400).json({ 
            status: '0', 
            msg: 'Datos de pago insuficientes en el body.' 
        });
    }

    try {
        const pedido = await Pedido.findByPk(pedidoId);
        if (!pedido) {
            console.log(`[BACKEND] Error: El pedido ID ${pedidoId} no existe.`);
            return res.status(404).json({ status: '0', msg: 'Pedido no encontrado' });
        }

        await PagoMercadoPago.create({ 
            pedidoId: Number(pedidoId), 
            mp_payment_id: String(mp_payment_id), 
            estado_pago: String(estado_pago) 
        });

        if (estado_pago === 'APROBADO' || estado_pago === 'approved') {
            await pedido.update({ estado_envio: 'Despachado' });
        }

        console.log(`[BACKEND] Éxito: Pago registrado para el Pedido #${pedidoId}`);
        return res.status(201).json({ status: '1', msg: 'Pago registrado con éxito' });

    } catch (error) {
        console.error('[BACKEND CRÍTICO] Falló la inserción en Sequelize:', error);
        return res.status(500).json({ 
            status: '0', 
            msg: 'Error interno al registrar el pago', 
            error: error.message 
        });
    }
};

pagoCtrl.obtenerPagos = async (req, res) => {
    try {
        const pagos = await PagoMercadoPago.findAll();
        return res.json(pagos);
    } catch (error) {
        return res.status(400).json({ status: '0', msg: 'Error al obtener los pagos.' });
    }
};

module.exports = pagoCtrl;