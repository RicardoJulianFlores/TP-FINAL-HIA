# GLPI - Mesa de Ayuda y Gestión Operativa (JOY-20)

Módulo de gestión de incidentes, mesa de ayuda y parametrización operativa ITIL para la infraestructura de Joyería Lumière.

## Arquitectura del Servicio

El servicio está completamente aislado de la base de datos de negocio PostgreSQL (JOY-18 / JOY-19) para permitir despliegues modulares e independientes según los requerimientos de recursos de cada entorno.

```
Host (Navegador / n8n) ──http://localhost:8085──► lumiere-glpi (GLPI 12.0)
                                                       │
                                            lumiere-ops-net
                                                       │
                                                  lumiere-glpi-db (MariaDB 10.11)
                                                       │
                                            volumen lumiere_glpi_db_data
```

## Estructura de Archivos

```
glpi/
├── docker-compose.yml       # Definición de contenedores lumiere-glpi y lumiere-glpi-db
├── .env.example             # Plantilla de variables de entorno (versionada en Git)
├── .env                     # Variables de entorno locales con contraseñas seguras (ignorado)
├── init-parametrizacion.sql # Script SQL idempotente de configuración inicial
├── setup.sh                 # Automatización completa de despliegue y parametrización
└── README.md                # Documentación operativa del servicio
```

## Puesta en Marcha Rápida (Script Automatizado)

La forma recomendada de desplegar e inicializar la plataforma es mediante el script `setup.sh`:

```bash
cd glpi
chmod +x setup.sh
./setup.sh
```

El script se encarga de:
1. Copiar `.env.example` a `.env` si no existe.
2. Levantar los contenedores `lumiere-glpi` y `lumiere-glpi-db`.
3. Aguardar a que MariaDB esté saludable (`healthy`).
4. Instalar de manera desatendida el esquema de base de datos de GLPI por CLI.
5. Aplicar la parametrización de Categorías ITIL, Usuarios y API REST (`init-parametrizacion.sql`).

## Despliegue Manual Paso a Paso

Si preferís realizar el despliegue de forma manual:

1. **Configurar el entorno**:
   ```bash
   cd glpi
   cp .env.example .env
   ```

2. **Iniciar los contenedores**:
   ```bash
   docker compose up -d
   ```

3. **Instalar el esquema de GLPI desatendido**:
   ```bash
   docker exec -u www-data lumiere-glpi php /var/www/html/glpi/bin/console db:install \
     --db-host=glpi-db \
     --db-name=lumiere_glpi \
     --db-user=glpi_user \
     --db-password=GLPI_UserPass2026! \
     --default-language=es_AR \
     --no-interaction
   docker exec lumiere-glpi rm -f /var/www/html/glpi/install/install.php
   ```

4. **Aplicar la parametrización ITIL, Usuarios y API**:
   ```bash
   docker exec -i lumiere-glpi-db mariadb -u glpi_user -pGLPI_UserPass2026! lumiere_glpi < init-parametrizacion.sql
   ```

## Acceso Web y Credenciales

- **URL de acceso**: [http://localhost:8085](http://localhost:8085)
- **Contraseña predeterminada para el equipo**: `Lumiere2026!`

| Usuario | Nombre Completo | Perfil asignado |
|---|---|---|
| `mchambi` | Marcos Chambi | Super-Admin / Técnico |
| `rflores` | Ricardo Flores | Super-Admin / Técnico |
| `cvazquez` | Carlos Vázquez | Super-Admin / Técnico |
| `l055` | Leonel | Super-Admin / Técnico |
| `jd` | Integrante JD | Super-Admin / Técnico |

*(La cuenta por defecto `glpi` con contraseña `glpi` también está disponible como Super-Admin inicial).*

## Categorías ITIL Parametrizadas

Se crearon las categorías de asistencia en `glpi_itilcategories` orientadas a los escenarios del proyecto:

1. **Seguridad Informática y Vulnerabilidades**: Hallazgos de auditorías npm/OWASP, gestión de tokens JWT y pasarelas de pago MercadoPago.
2. **Rendimiento y Base de Datos**: Alertas de latencia, optimización de queries y soporte a la tabla de 6 millones de registros (JOY-19).
3. **Infraestructura, Red y Contenedores**: Despliegues Docker, caídas de servicios y enlaces Cloudflare Tunnel.
4. **Alertas Automáticas (Prometheus / n8n)**: Incidentes generados automáticamente por el pipeline de n8n (JOY-30 / Sprint 3).

## API REST para Automatización (n8n / JOY-30)

La API REST se encuentra habilitada con autenticación por credenciales y App-Token:

- **Endpoint base**: `http://localhost:8085/apirest.php`
- **Cliente configurado**: `n8n-automation-client` (acceso permitido para cualquier IP del entorno Docker)
- **App-Token**: `LumiereN8NAppToken2026SecureKeyJOY30`

### Prueba de Inicialización de Sesión (API)

```bash
curl -X GET \
  -H "App-Token: LumiereN8NAppToken2026SecureKeyJOY30" \
  -u "mchambi:Lumiere2026!" \
  http://localhost:8085/apirest.php/initSession
```

Respuesta esperada:
```json
{
  "session_token": "<token_de_sesion>"
}
```
