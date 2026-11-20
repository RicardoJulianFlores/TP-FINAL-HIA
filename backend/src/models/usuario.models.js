const { DataTypes } = require('sequelize');
const sequelize = require('../../config/database');
const Acceso = require('../models/acceso.model');

const  Usuario = sequelize.define('Usuario', {
    username: { type: DataTypes.STRING, allowNull: false },
    
    password: { type: DataTypes.STRING, allowNull: false },

    nombres: { type: DataTypes.STRING, allowNull: false },

    apellido: { type: DataTypes.STRING, allowNull: false },

    perfil: { type: DataTypes.STRING, allowNull: false } ,//ADMINISTRADOR-CLIENTE-EMPLEADO

    email: { type: DataTypes.STRING, allowNull: false, unique: true, validate: { isEmail: true } }// Validación nativa del servidor

}, {
    tableName: 'usuarios',
    timestamps: true,
});

Usuario.hasMany(Acceso, { foreignKey: 'usuarioId', as: 'accesos' });
Acceso.belongsTo(Usuario, { foreignKey: 'usuarioId', as: 'usuario' });

module.exports = Usuario;