# Use uma imagem Node.js como base
FROM node:16

# Defina o diretório de trabalho dentro do container
WORKDIR /app

# Copie os arquivos de dependência do Node.js para o container
COPY package*.json ./

# Instale as dependências
RUN npm install --production

# Copie o restante do código da aplicação
COPY . .

# Defina a variável de ambiente PORT para 8080
ENV PORT 8080

# Exponha a porta 8080 para o Google Cloud Run
EXPOSE 8080

# Comando para iniciar a aplicação
CMD ["npm", "start"]
