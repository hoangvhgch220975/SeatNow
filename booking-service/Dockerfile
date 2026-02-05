# Minimal Dockerfile for booking-service
FROM node:18-alpine
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm ci --production
COPY . .
EXPOSE 3003
CMD ["node", "src/index.js"]
