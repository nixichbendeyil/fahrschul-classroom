FROM node:20-alpine
WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY tsconfig.json ./
COPY src ./src

RUN npm install -D typescript @types/node @types/express @types/jsonwebtoken @types/cors tsx \
  && npm run build \
  && npm prune --production

EXPOSE 3002
CMD ["node", "dist/index.js"]
