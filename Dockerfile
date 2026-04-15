FROM mcr.microsoft.com/playwright:v1.59.1-noble

WORKDIR /app

# Solo copiar archivos de dependencias (esto se cachea)
COPY package.json package-lock.json ./

# Instalar dependencias
RUN npm ci

# NO copiamos código fuente — se monta como volumen
