const { DataTypes } = require('sequelize');
const sequelize = require('../../config/database');

const Usuario = require('../models/usuario.models');

const Pedido = sequelize.define('Pedido', {
    
    fecha: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },

    total: { type: DataTypes.DECIMAL(10, 2), allowNull: false },

    estado_envio: { type: DataTypes.STRING, defaultValue: 'Pendiente' }, // Pendiente, Despachado, Entregado

    id_mercado_pago: { type: DataTypes.STRING, allowNull: true } // ID de MercadoPago

}, { 
    tableName: 'pedidos', 
    timestamps: true 
});

Usuario.hasMany(Pedido, { foreignKey: 'usuarioId' });
Pedido.belongsTo(Usuario, { foreignKey: 'usuarioId' });

module.exports = Pedido;