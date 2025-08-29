FROM node:20-bookworm

# Instala Ghostscript, ImageMagick, Tesseract e Poppler
RUN apt-get update && apt-get install -y --no-install-recommends \
    ghostscript imagemagick \
    tesseract-ocr tesseract-ocr-por tesseract-ocr-eng \
    poppler-utils \
  && rm -rf /var/lib/apt/lists/*

# Cria diretório de trabalho
WORKDIR /usr/src/app

# Copia arquivos de dependências
COPY package*.json ./
RUN npm ci --omit=dev

# Copia o restante do código
COPY . .

# Porta exposta
EXPOSE 8080

# Comando de start
CMD ["node", "server.js"]
