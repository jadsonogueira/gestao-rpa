FROM node:18

# Instala Ghostscript e ImageMagick
RUN apt-get update && apt-get install -y ghostscript imagemagick

# Cria diretório de trabalho
WORKDIR /usr/src/app

# Copia arquivos de dependências
COPY package*.json ./
RUN npm install

# Copia o restante do código
COPY . .

EXPOSE 8080
CMD ["npm", "start"]
