# ==========================================
# ETAPA 1: Compilación de Angular con Node 22
# ==========================================
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build -- --configuration production

# ==========================================
# ETAPA 2: Servidor Web Nginx
# ==========================================
FROM nginx:alpine

# Parchear paquetes base del SO (Alpine) contra CVEs críticos/altos
RUN apk update && apk upgrade --no-cache

# Limpiar los archivos por defecto de Nginx ("Welcome to nginx!")
RUN rm -rf /usr/share/nginx/html/*

# Copiar la configuración personalizada de SPA
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copiar directamente el contenido interno de browser a la raíz de Nginx
COPY --from=builder /app/dist/joyeria-app/browser/ /usr/share/nginx/html/

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]