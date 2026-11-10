# Trabajo Final Integrador - Backend 
### Asignatura: Programación y Servicios Web
### Facultad de Ingeniería – Universidad Nacional de Jujuy (UNJU)

Este repositorio contiene el código fuente del backend para el Sistema de Gestión de Compraventa (E-commerce), desarrollado bajo una arquitectura RESTful utilizando el patrón MVC.

---

## Tecnologías Utilizadas
 **Entorno de Ejecución:** Node.js
 **Framework Web:** Express.js
 **Base de Datos:** PostgreSQL
 **ORM:** Sequelize
 **Seguridad y Autenticación:** JSON Web Tokens (JWT) & Bcryptjs
 **Variables de Entorno:** Dotenv
 **Herramientas de Testing:** Postman 

---

## Estructura de Carpetas (MVC)

src/
├── config/        # Conexión a PostgreSQL 
├── controllers/   # Lógica de negocio (Controladores para CRUDs)
├── middlewares/   # Control de acceso por roles y verificación de JWT
├── models/        # Modelos de datos de Sequelize (Mapeo de tablas)
└── routes/        # Definición de rutas y endpoints de la API
 