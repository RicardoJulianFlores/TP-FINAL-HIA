-- ==============================================================
-- Esquema de Joyería Lumière (PostgreSQL)
-- Generado con pg_dump a partir de las tablas que crea Sequelize
-- (sequelize.sync) en el backend, para que ambos coincidan.
-- Se ejecuta SOLO la primera vez, cuando el volumen pgdata está vacío.
-- ==============================================================


CREATE TABLE public.accesos (
    id integer NOT NULL,
    fecha_hora timestamp with time zone,
    ip_origen character varying(255) NOT NULL,
    accion_realizada character varying(255) NOT NULL,
    "usuarioId" integer
);

CREATE SEQUENCE public.accesos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.accesos_id_seq OWNED BY public.accesos.id;

CREATE TABLE public.configuracion (
    id integer NOT NULL,
    "longitudMinima" integer DEFAULT 8 NOT NULL,
    "requiereMayusculas" boolean DEFAULT true,
    "requiereNumeros" boolean DEFAULT true,
    "requiereEspeciales" boolean DEFAULT true,
    "intentosPermitidos" integer DEFAULT 5,
    "tiempoBloqueoMinutos" integer DEFAULT 15,
    "bloquearAutomaticamente" boolean DEFAULT true,
    "tiempoInactividadMinutos" integer DEFAULT 30,
    "cerrarSesionAutomaticamente" boolean DEFAULT true,
    "permitirMultiplesSesiones" boolean DEFAULT false,
    "autenticacionPassword" boolean DEFAULT true,
    "autenticacion2FA" boolean DEFAULT false,
    "loginGoogle" boolean DEFAULT false
);

CREATE SEQUENCE public.configuracion_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.configuracion_id_seq OWNED BY public.configuracion.id;

CREATE TABLE public.contactos (
    id integer NOT NULL,
    nombre character varying(255) NOT NULL,
    email character varying(255) NOT NULL,
    telefono character varying(255),
    mensaje text NOT NULL,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);

CREATE SEQUENCE public.contactos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.contactos_id_seq OWNED BY public.contactos.id;

CREATE TABLE public.detalles (
    id integer NOT NULL,
    cantidad integer NOT NULL,
    precio_unitario numeric(10,2) NOT NULL,
    "pedidoId" integer,
    "productoId" integer
);

CREATE SEQUENCE public.detalles_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.detalles_id_seq OWNED BY public.detalles.id;

CREATE TABLE public.pagos (
    id integer NOT NULL,
    mp_payment_id character varying(255) NOT NULL,
    estado_pago character varying(255) NOT NULL,
    fecha_pago timestamp with time zone,
    "pedidoId" integer
);

CREATE SEQUENCE public.pagos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.pagos_id_seq OWNED BY public.pagos.id;

CREATE TABLE public.pedidos (
    id integer NOT NULL,
    fecha timestamp with time zone,
    total numeric(10,2) NOT NULL,
    estado_envio character varying(255) DEFAULT 'Pendiente'::character varying,
    id_mercado_pago character varying(255),
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    "usuarioId" integer
);

CREATE SEQUENCE public.pedidos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.pedidos_id_seq OWNED BY public.pedidos.id;

CREATE TABLE public.productos (
    id integer NOT NULL,
    nombre character varying(255) NOT NULL,
    categoria character varying(255) NOT NULL,
    precio double precision NOT NULL,
    descuento double precision DEFAULT '0'::double precision,
    imagen character varying(255) NOT NULL,
    descripcion text,
    material character varying(255),
    destacado boolean NOT NULL,
    stock integer NOT NULL,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);

CREATE SEQUENCE public.productos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.productos_id_seq OWNED BY public.productos.id;

CREATE TABLE public.usuarios (
    id integer NOT NULL,
    username character varying(255) NOT NULL,
    password character varying(255) NOT NULL,
    nombres character varying(255) NOT NULL,
    apellido character varying(255) NOT NULL,
    perfil character varying(255) NOT NULL,
    email character varying(255) NOT NULL,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);

CREATE SEQUENCE public.usuarios_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.usuarios_id_seq OWNED BY public.usuarios.id;

ALTER TABLE ONLY public.accesos ALTER COLUMN id SET DEFAULT nextval('public.accesos_id_seq'::regclass);

ALTER TABLE ONLY public.configuracion ALTER COLUMN id SET DEFAULT nextval('public.configuracion_id_seq'::regclass);

ALTER TABLE ONLY public.contactos ALTER COLUMN id SET DEFAULT nextval('public.contactos_id_seq'::regclass);

ALTER TABLE ONLY public.detalles ALTER COLUMN id SET DEFAULT nextval('public.detalles_id_seq'::regclass);

ALTER TABLE ONLY public.pagos ALTER COLUMN id SET DEFAULT nextval('public.pagos_id_seq'::regclass);

ALTER TABLE ONLY public.pedidos ALTER COLUMN id SET DEFAULT nextval('public.pedidos_id_seq'::regclass);

ALTER TABLE ONLY public.productos ALTER COLUMN id SET DEFAULT nextval('public.productos_id_seq'::regclass);

ALTER TABLE ONLY public.usuarios ALTER COLUMN id SET DEFAULT nextval('public.usuarios_id_seq'::regclass);

ALTER TABLE ONLY public.accesos
    ADD CONSTRAINT accesos_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.configuracion
    ADD CONSTRAINT configuracion_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.contactos
    ADD CONSTRAINT contactos_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.detalles
    ADD CONSTRAINT detalles_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.pagos
    ADD CONSTRAINT pagos_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.pedidos
    ADD CONSTRAINT pedidos_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.productos
    ADD CONSTRAINT productos_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_email_key UNIQUE (email);

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.accesos
    ADD CONSTRAINT "accesos_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES public.usuarios(id) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE ONLY public.detalles
    ADD CONSTRAINT "detalles_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES public.pedidos(id) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE ONLY public.detalles
    ADD CONSTRAINT "detalles_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES public.productos(id) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE ONLY public.pagos
    ADD CONSTRAINT "pagos_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES public.pedidos(id) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE ONLY public.pedidos
    ADD CONSTRAINT "pedidos_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES public.usuarios(id) ON UPDATE CASCADE ON DELETE SET NULL;

