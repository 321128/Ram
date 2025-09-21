# Use Node.js base image
FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci || npm install

COPY . .

# Build frontend and backend
# No build step needed for dev:docker, as volumes will mount source

EXPOSE 5174

CMD ["node", "dist-server/server/server.js"]