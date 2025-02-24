# Usar imagem oficial do Node.js
FROM node:18

# Definir diretório de trabalho
WORKDIR /app

# Copiar arquivos necessários
COPY package.json yarn.lock ./

# Instalar dependências
RUN yarn install --production

# Copiar o restante do código
COPY . .

# Expor a porta do servidor (ajuste conforme necessário)
EXPOSE 3000

# Comando para rodar a aplicação
CMD ["yarn", "start"]
