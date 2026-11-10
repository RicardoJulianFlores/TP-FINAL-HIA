const { DataTypes } = require('sequelize');
const sequelize = require('../../config/database');

const Pedido = require('../models/pedido.models');

const PagoMercadoPago = sequelize.define('PagoMercadoPago', {

    mp_payment_id: { type: DataTypes.STRING, allowNull: false }, // ID de pago en la plataforma MP

    estado_pago: { type: DataTypes.STRING, allowNull: false }, //APROBADO o RECHAZADO

    fecha_pago: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }

}, { 
    tableName: 'pagos', 
    timestamps: false 
});

Pedido.hasOne(PagoMercadoPago, { foreignKey: 'pedidoId'});
PagoMercadoPago.belongsTo(Pedido, { foreignKey: 'pedidoId' });

module.exports = PagoMercadoPago;