-- ==============================================================================
-- Joyería Lumière - HIA Práctica Integradora Final
-- JOY-20: Parametrización Inicial de GLPI (Categorías ITIL, Usuarios y API REST)
-- ==============================================================================

USE lumiere_glpi;

-- ------------------------------------------------------------------------------
-- 1. Categorías ITIL (glpi_itilcategories)
-- ------------------------------------------------------------------------------
INSERT INTO glpi_itilcategories (
    entities_id, is_recursive, itilcategories_id, name, completename, comment,
    level, is_helpdeskvisible, is_incident, is_request, is_problem, is_change,
    date_creation, date_mod
)
SELECT 0, 1, 0,
       'Seguridad Informática y Vulnerabilidades',
       'Seguridad Informática y Vulnerabilidades',
       'Incidentes de seguridad, vulnerabilidades detectadas en auditorías npm/OWASP, gestión de tokens JWT y pasarelas de pago MercadoPago.',
       1, 1, 1, 1, 1, 1, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM glpi_itilcategories WHERE name = 'Seguridad Informática y Vulnerabilidades');

INSERT INTO glpi_itilcategories (
    entities_id, is_recursive, itilcategories_id, name, completename, comment,
    level, is_helpdeskvisible, is_incident, is_request, is_problem, is_change,
    date_creation, date_mod
)
SELECT 0, 1, 0,
       'Rendimiento y Base de Datos',
       'Rendimiento y Base de Datos',
       'Alertas de latencia, optimización de queries y problemas de rendimiento en base de datos PostgreSQL con 6M de registros.',
       1, 1, 1, 1, 1, 1, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM glpi_itilcategories WHERE name = 'Rendimiento y Base de Datos');

INSERT INTO glpi_itilcategories (
    entities_id, is_recursive, itilcategories_id, name, completename, comment,
    level, is_helpdeskvisible, is_incident, is_request, is_problem, is_change,
    date_creation, date_mod
)
SELECT 0, 1, 0,
       'Infraestructura, Red y Contenedores',
       'Infraestructura, Red y Contenedores',
       'Incidentes en entornos Docker, conectividad, caídas de contenedores o servicios y enlaces Cloudflare Tunnel.',
       1, 1, 1, 1, 1, 1, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM glpi_itilcategories WHERE name = 'Infraestructura, Red y Contenedores');

INSERT INTO glpi_itilcategories (
    entities_id, is_recursive, itilcategories_id, name, completename, comment,
    level, is_helpdeskvisible, is_incident, is_request, is_problem, is_change,
    date_creation, date_mod
)
SELECT 0, 1, 0,
       'Alertas Automáticas (Prometheus / n8n)',
       'Alertas Automáticas (Prometheus / n8n)',
       'Incidentes autogenerados mediante webhooks y alertas del pipeline de n8n y métricas de Prometheus.',
       1, 1, 1, 1, 1, 1, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM glpi_itilcategories WHERE name = 'Alertas Automáticas (Prometheus / n8n)');

-- ------------------------------------------------------------------------------
-- 2. Habilitación de la API REST (glpi_configs)
-- ------------------------------------------------------------------------------
UPDATE glpi_configs SET value = '1' WHERE context = 'core' AND name = 'enable_api';
UPDATE glpi_configs SET value = '1' WHERE context = 'core' AND name = 'enable_api_login_credentials';
UPDATE glpi_configs SET value = '1' WHERE context = 'core' AND name = 'enable_api_login_external_token';

-- ------------------------------------------------------------------------------
-- 3. Cliente de API REST para Automatización n8n (glpi_apiclients)
--    App-Token: LumiereN8NAppToken2026SecureKeyJOY30
-- ------------------------------------------------------------------------------
INSERT INTO glpi_apiclients (
    entities_id, is_recursive, name, is_active, ipv4_range_start, ipv4_range_end, ipv6,
    app_token, app_token_date, dolog_method, comment, date_creation, date_mod
)
SELECT 0, 1, 'n8n-automation-client', 1, NULL, NULL, NULL,
       'Ik6wLR54mhfqgFYgISiKaG8UJCKgsnbKEEA2BTuNXjgMH0we8RDpQsUW9cpYRjLWNFvbDaB1HmdvRamPWcgMiSY8bxBjkdzJE8TSbA==',
       NOW(), 0, 'Cliente API para orquestación y automatización de tickets vía n8n (JOY-30 / Sprint 3)',
       NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM glpi_apiclients WHERE name = 'n8n-automation-client');

-- ------------------------------------------------------------------------------
-- 4. Usuarios del Equipo (glpi_users y glpi_profiles_users)
--    Contraseña por defecto: Lumiere2026!
-- ------------------------------------------------------------------------------
-- mchambi
INSERT INTO glpi_users (name, password, realname, firstname, is_active, profiles_id, entities_id, date_creation, date_mod)
SELECT 'mchambi', '.LF.hKbpdOsHqMOCs.KYRtuVh7xsEub2s/2GjAViMgqzEam7S', 'Chambi', 'Marcos', 1, 4, 0, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM glpi_users WHERE name = 'mchambi');

-- rflores
INSERT INTO glpi_users (name, password, realname, firstname, is_active, profiles_id, entities_id, date_creation, date_mod)
SELECT 'rflores', '.LF.hKbpdOsHqMOCs.KYRtuVh7xsEub2s/2GjAViMgqzEam7S', 'Flores', 'Ricardo', 1, 4, 0, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM glpi_users WHERE name = 'rflores');

-- cvazquez
INSERT INTO glpi_users (name, password, realname, firstname, is_active, profiles_id, entities_id, date_creation, date_mod)
SELECT 'cvazquez', '.LF.hKbpdOsHqMOCs.KYRtuVh7xsEub2s/2GjAViMgqzEam7S', 'Vázquez', 'Carlos', 1, 4, 0, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM glpi_users WHERE name = 'cvazquez');

-- l055
INSERT INTO glpi_users (name, password, realname, firstname, is_active, profiles_id, entities_id, date_creation, date_mod)
SELECT 'l055', '.LF.hKbpdOsHqMOCs.KYRtuVh7xsEub2s/2GjAViMgqzEam7S', 'Leonel', 'Leo', 1, 4, 0, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM glpi_users WHERE name = 'l055');

-- jd
INSERT INTO glpi_users (name, password, realname, firstname, is_active, profiles_id, entities_id, date_creation, date_mod)
SELECT 'jd', '.LF.hKbpdOsHqMOCs.KYRtuVh7xsEub2s/2GjAViMgqzEam7S', 'JD', 'Integrante', 1, 4, 0, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM glpi_users WHERE name = 'jd');

-- Asignación de perfiles Super-Admin (4) y Técnico (6) a cada usuario
INSERT INTO glpi_profiles_users (users_id, profiles_id, entities_id, is_recursive, is_dynamic, is_default_profile)
SELECT u.id, 4, 0, 1, 0, 1
FROM glpi_users u
WHERE u.name IN ('mchambi', 'rflores', 'cvazquez', 'l055', 'jd')
  AND NOT EXISTS (
    SELECT 1 FROM glpi_profiles_users pu WHERE pu.users_id = u.id AND pu.profiles_id = 4
  );

INSERT INTO glpi_profiles_users (users_id, profiles_id, entities_id, is_recursive, is_dynamic, is_default_profile)
SELECT u.id, 6, 0, 1, 0, 0
FROM glpi_users u
WHERE u.name IN ('mchambi', 'rflores', 'cvazquez', 'l055', 'jd')
  AND NOT EXISTS (
    SELECT 1 FROM glpi_profiles_users pu WHERE pu.users_id = u.id AND pu.profiles_id = 6
  );
