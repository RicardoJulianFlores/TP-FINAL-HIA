const { DataTypes } = require("sequelize");
const sequelize = require("../../config/database");

const Configuracion = sequelize.define("Configuracion", {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true},
    longitudMinima: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 8 },
    requiereMayusculas: { type: DataTypes.BOOLEAN, defaultValue: true },
    requiereNumeros: { type: DataTypes.BOOLEAN, defaultValue: true },
    requiereEspeciales: { type: DataTypes.BOOLEAN, defaultValue: true },
    intentosPermitidos: { type: DataTypes.INTEGER, defaultValue: 5 },
    tiempoBloqueoMinutos: {  type: DataTypes.INTEGER, defaultValue: 15 },
    bloquearAutomaticamente: {  type: DataTypes.BOOLEAN, defaultValue: true },
    tiempoInactividadMinutos: { type: DataTypes.INTEGER, defaultValue: 30 },
    cerrarSesionAutomaticamente: { type: DataTypes.BOOLEAN, defaultValue: true },
    permitirMultiplesSesiones: { type: DataTypes.BOOLEAN, defaultValue: false },
    autenticacionPassword: { type: DataTypes.BOOLEAN, defaultValue: true },
    autenticacion2FA: { type: DataTypes.BOOLEAN, defaultValue: false },
    loginGoogle: { type: DataTypes.BOOLEAN, defaultValue: false }

}, {
    tableName: "configuracion",
    timestamps: false
});

module.exports = Configuracion;