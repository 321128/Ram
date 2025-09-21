# Use Node.js base image
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci || npm install

COPY . .

# Build frontend and backend
RUN npm run build:all

EXPOSE 5174

CMD ["node", "dist-server/server/server.js"]