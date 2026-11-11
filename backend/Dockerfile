# ==========================================
# ETAPA 1: Dependencias y Preparación
# ==========================================
FROM node:18-alpine AS builder

WORKDIR /app

# Copiar manifiestos de paquetes
COPY package*.json ./

# Instalar todas las dependencias
RUN npm ci

# Copiar el resto del código del backend
COPY . .

# ==========================================
# ETAPA 2: Runtime de Producción Ligero
# ==========================================
FROM node:18-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Copiar únicamente los manifiestos e instalar solo paquetes de producción
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copiar desde la etapa builder el código fuente necesario
COPY --from=builder /app/src ./src
COPY --from=builder /app/config ./config
COPY --from=builder /app/index.js ./index.js
COPY --from=builder /app/swagger.js ./swagger.js
COPY --from=builder /app/swagger_output.json ./swagger_output.json

# Exponer el puerto donde escucha Express
EXPOSE 3000

# Proceso principal de ejecución
CMD ["node", "index.js"]