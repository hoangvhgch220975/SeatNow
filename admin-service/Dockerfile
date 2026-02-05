# Minimal Dockerfile for admin-service
FROM node:18-alpine
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm ci --production
COPY . .
EXPOSE 3006
CMD ["node", "src/index.js"]
