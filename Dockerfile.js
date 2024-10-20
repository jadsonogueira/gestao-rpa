# Use uma imagem base Node.js
FROM node:16

# Defina o diretório de trabalho dentro do container
WORKDIR /usr/src/app

# Copie o package.json e package-lock.json para o diretório de trabalho
COPY package*.json ./

# Instale as dependências do projeto
RUN npm install --production

# Copie todo o código da aplicação para o diretório de trabalho
COPY . .

# Exponha a porta que a aplicação utiliza
EXPOSE 3000

# Comando para iniciar a aplicação
CMD [ "npm", "start" ]
