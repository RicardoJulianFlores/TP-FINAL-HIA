const jwt = require('jsonwebtoken');
const authCtrl = {}

authCtrl.verifyToken = async (req, res, next) => {
    // 1. Validar si el header existe antes de hacer split
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).json({
            message: 'Unauthorized request: No token provided.'
        });
    }
    // 2. Extraer el token separando por el espacio
    const token = authHeader.split(' ')[1];
    // 3. Validar que el token no sea undefined o esté vacío
    if (!token || token === 'null') {
        return res.status(401).json({
            message: 'Unauthorized request: Invalid token format.'
        });
    }
    try {
        const payload = jwt.verify(token, "secretkey");
        req.userId = payload.id;
        req.userPerfil = payload.perfil;
        next();
    } catch (error) {
        return res.status(401).json({
            message: 'Unauthorized request: Invalid or expired token.'
        });
    }
}

// Middleware para control de acceso por roles
authCtrl.isAdmin = (req, res, next) => {
    if (req.userPerfil && req.userPerfil === 'Administrador') {
        next();
    } else {
        return res.status(403).json({ status: 0, msg: 'Acceso denegado: Se requieren permisos de Administrador.' });
    }
};

authCtrl.isEmpleado = (req, res, next) => {
    if (req.userPerfil && req.userPerfil === 'Empleado') {
        next();
    } else {
        return res.status(403).json({ status: 0, msg: 'Acceso denegado: Se requieren permisos de Empleado.' });
    }
};

module.exports = authCtrl;