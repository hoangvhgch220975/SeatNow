# Minimal Dockerfile for payment-service
FROM node:18-alpine
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm ci --production
COPY . .
EXPOSE 3004
CMD ["node", "src/index.js"]
