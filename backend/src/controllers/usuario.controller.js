const Usuario = require('./../models/usuario.models')
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { OAuth2Client } = require('google-auth-library');
const Acceso = require('../models/acceso.model');

const usuarioCtrl = {}

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

usuarioCtrl.loginUsuario = async (req, res) => {
    /*
    #swagger.tags = ['Usuario']
    #swagger.summary = 'Iniciar sesión de un usuario'
    #swagger.parameters['body'] = {
        in: 'body',
        required: true,
        schema: {
            username: 'juanperez',
            password: '123456'
        }
    }
    #swagger.responses[200] = {
        description: 'Login exitoso',
        schema: {
            status: 1,
            msg: 'success',
            username: 'juanperez',
            perfil: 'administrador',
            userid: 1,
            token: 'jwt_token_here'
        }
    }
*/
    if (!req.body.username || !req.body.password) {
        return res.status(400).json({ status: 0, msg: "Faltan credenciales" });
    }

    try {
        const user = await Usuario.findOne({ where: { username: req.body.username } });
        
        if (!user) {
            return res.status(400).json({ status: 0, msg: "Usuario no encontrado" });
        }

        const isMatch = await bcrypt.compare(req.body.password, user.password);
        if (!isMatch) {
            return res.status(401).json({ status: 0, msg: "Credenciales incorrectas", id:user.id});
        }

        const unToken = jwt.sign(
            { id: user.id, perfil: user.perfil }, 
            process.env.JWT_SECRET
        );

        res.json({
            status: 1,
            msg: "success",
            username: user.username,
            perfil: user.perfil,
            userid: user.id,
            nombre: user.nombres,
            apellido: user.apellido,
            email: user.email,
            token: unToken
        });

    } catch (error) {
        res.status(500).json({ status: 0, msg: 'error', error: error.message });
    }
}


usuarioCtrl.loginGoogle = async (req, res) => {
    /*
    #swagger.tags = ['Usuario']
    #swagger.summary = 'Iniciar sesión con Google OAuth'
    #swagger.parameters['body'] = {
        in: 'body',
        required: true,
        schema: { credential: 'eyJhbGciOi...' }
    }
    */
    const { credential } = req.body;

    if (!credential) {
        return res.status(400).json({ status: 0, msg: 'Falta el credential de Google' });
    }

    try {
        // 1. Verificamos el token contra los servidores de Google 
        const ticket = await googleClient.verifyIdToken({
            idToken: credential,
            audience: process.env.GOOGLE_CLIENT_ID
        });
        const payload = ticket.getPayload(); 

        // 2. Buscamos si ya existe un usuario con ese email
        let user = await Usuario.findOne({ where: { email: payload.email } });

        // 3. Si no existe, lo creamos como cliente nuevo
        if (!user) {
            // La tabla exige password (allowNull:false), así que generamos una
            // aleatoria y la hasheamos igual que en un registro normal.
            // El usuario nunca la va a necesitar porque siempre entra por Google.
            const randomPassword = crypto.randomBytes(16).toString('hex');
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(randomPassword, salt);

            user = await Usuario.create({
                username: payload.name,
                password: hashedPassword,
                nombres: payload.given_name || payload.name || 'Usuario',
                apellido: payload.family_name || 'Google',
                perfil: 'Cliente',
                email: payload.email
            });
        }

        // 4. Generamos NUESTRO propio JWT, igual que en el login normal,
        //    para que el resto del sistema (interceptor, verifyToken, isAdmin)
        //    funcione exactamente igual sin importar cómo se logueó.
        const unToken = jwt.sign(
            { id: user.id, perfil: user.perfil },
            process.env.JWT_SECRET,
            { expiresIn: '2h' }
        );

        res.json({
            status: 1,
            msg: "success",
            username: user.username,
            perfil: user.perfil,
            userid: user.id,
            nombre: user.nombres,
            apellido: user.apellido,
            email: user.email,
            token: unToken
        });

    } catch (error) {
        // Token inválido, expirado, o no corresponde a este Client ID
        res.status(401).json({ status: 0, msg: 'Token de Google inválido', error: error.message });
    }
}


//crear usuarios
usuarioCtrl.createUsuario = async (req, res) => {
    /*
        #swagger.tags = ['Usuario']
        #swagger.summary = 'Crear un nuevo usuario'
        #swagger.parameters['body'] = {
            in: 'body',
            required: true,
            schema: { $ref: '#/definitions/Usuario' }
        }
        */
    //en req.body se espera que vengan los datos de usuario a crear
    const data = req.body;
    try {
        if (data.password) {
            // CORRECCIÓN: Hasheo de la contraseña antes de guardar en la BD
            const salt = await bcrypt.genSalt(10);
            data.password = await bcrypt.hash(data.password, salt);
        }

        await Usuario.create(data);
        res.status(200).json({ status: '1', msg: 'Usuario guardado.' });
    } catch (error) {
        res.status(400).json({ status: '0', msg: 'Error procesando operacion.' });
    }
}

// Obtener todos los socios
usuarioCtrl.getUsuarios = async (req, res) => {
    /*
        #swagger.tags = ['Usuario']
        #swagger.summary = 'Obtener todos los usuarios'
        */
    try {
        const usuarios = await Usuario.findAll({ 
            include:[{
                model: Acceso,
                as: "accesos",
                attributes: {
                    exclude: ['usuarioId']
                },
            }]
        });
        res.json(usuarios);
    } catch (error) {
        res.status(500).json({ status: '0', msg: 'Error al obtener los Usuarios.' });
    }
};

// Eliminar un socio
usuarioCtrl.deleteUsuario = async (req, res) => {
    /*
        #swagger.tags = ['Usuario']
        #swagger.summary = 'Eliminar un usuario'
        #swagger.parameters['id'] = {
            in: 'path',
            required: true,
            type: 'integer'
        }
        */
    try {
        // .destroy() elimina el registro que coincida con el ID enviado por parámetro
        await Usuario.destroy({
            where: { id: req.params.id }
        });
        res.json({ status: '1', msg: 'Usuario removed' });
    } catch (error) {
        res.status(400).json({ status: '0', msg: 'Error procesando la operacion' });
    }
};

// Editar un socio
usuarioCtrl.editUsuario = async (req, res) => {
    /*
        #swagger.tags = ['Usuario']
        #swagger.summary = 'Modificar un usuario'
        #swagger.parameters['id'] = {
            in: 'path',
            required: true,
            type: 'integer'
        }
        #swagger.parameters['body'] = {
            in: 'body',
            required: true,
            schema: { $ref: '#/definitions/Usuario' }
        }
        */
    const data = req.body;
    try {
        const usuarios = await Usuario.findByPk(req.params.id);
        if (usuarios) {
            if (data.password) {
                const bcrypt = require('bcryptjs');
                const salt = await bcrypt.genSalt(10);
                data.password = await bcrypt.hash(data.password, salt);
            } else {
                delete data.password;
            }
            await usuarios.update(data);
            res.status(200).json({ status: '1', msg: 'Usuario actualizado' });
        } else {
            res.status(404).json({ status: '0', msg: 'Usuario no encontrado' });
        }
    }
    catch (error) {
        res.status(500).json({ message: 'Error al actualizar Usuario', error: error.message });
    }
};


// Obtener usuario por ID
usuarioCtrl.gerUsuarioPorId = async (req, res) => {
    /*
        #swagger.tags = ['Usuario']
        #swagger.summary = 'Obtener usuario por ID'
    */
    try {
        // Buscamos por la clave primaria (id numérico)
        const usuario = await Usuario.findByPk(req.params.id);
        if (!usuario) {
            return res.status(404).json({ status: '0', msg: 'Usuario no encontrado.' });
        }
        res.json(usuario);
    } catch (error) {
        res.status(500).json({ status: '0', msg: 'Error al obtener el Usuario.' });
    }
};

// Crear un acceso
usuarioCtrl.addAcceso = async (req, res) => {
    try {
        data = req.body;
        const usuario = await Usuario.findByPk(req.params.id);
        if (usuario) {
            data.usuarioId = usuario.id;
            const acceso = await Acceso.create(data);
            res.status(200).json({status: '1', msg: 'Acceso agregado.'});
        } else {
            res.status(404).json({status: '0', msg: 'Usuario no encontrado.'});
        }
    } catch (error) {
        res.status(500).json({message: 'Error al agregar acceso', error: error.message});
    }
};



//Buscar parcialmente por nombre
usuarioCtrl.getBuscarCoincidenciaEnNombre = async (req, res) => {
    /*
        #swagger.tags = ['Usuario']
        #swagger.summary = 'Buscar socios por coincidencia en nombre.'
        #swagger.description = 'Busca en la columna de nombres, los usuarios que tengan coincidencia con la descripcion que se coloca.'
        #swagger.parameters['nombres'] = {
            in: 'path',
            required: true,
            type: 'string'
        }
        */
    console.log("Entró a buscarPorNombre");
    try {
        const usuarios = await Usuario.findAll({
            where: {
                [Op.or]: [
                    {
                        nombres: { [Op.iLike]: `%${req.params.texto}%` }
                    },
                    {
                        apellido: {
                            [Op.iLike]: `%${req.params.texto}%`
                        }
                    },
                    {
                        email: {
                            [Op.iLike]: `%${req.params.texto}%`
                        }
                    }
                ]
            }
        });
        if (usuarios.length !== 0) {
            res.json(usuarios);
        } else {
            res.status(404).json({ status: '0', msg: 'No hay coincidencias.' })
        }




    } catch {
        res.status(500).json({ status: '0', msg: 'Error al obtener los usuarios con esas coincidencias.' })
    }
};

//exportacion del modulo controlador
module.exports = usuarioCtrl;