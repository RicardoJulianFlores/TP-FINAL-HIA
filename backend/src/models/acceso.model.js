const { DataTypes } = require('sequelize');
const sequelize = require('../../config/database');

const Acceso = sequelize.define('Acceso', {

    fecha_hora: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },

    ip_origen: { type: DataTypes.STRING, allowNull: false },

    accion_realizada: { type: DataTypes.STRING, allowNull: false } // Login exitoso, Intento fallido

}, { tableName: 'accesos', timestamps: false });

module.exports = Acceso;