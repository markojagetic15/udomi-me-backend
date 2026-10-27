# --- Faza 1: Build (potrebni devDependencies poput @nestjs/cli za `nest build`) ---
FROM node:18-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

RUN npm run build

# --- Faza 2: Produkcijski image (samo runtime ovisnosti + dist/) ---
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY --from=build /app/dist ./dist

EXPOSE 5000

CMD ["node", "dist/main"]
