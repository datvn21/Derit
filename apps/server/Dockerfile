FROM node:22-alpine

WORKDIR /app

RUN apk add --no-cache openjdk11 python3 bash nsjail

COPY package.json package-lock.json ./
RUN npm ci
COPY package*.json ./
RUN npm ci || npm install

COPY . .

EXPOSE 3000

CMD ["node", "index.js"]
