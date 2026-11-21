FROM node:22-alpine AS build
WORKDIR /app
COPY package.json tsconfig.json ./
RUN npm install
COPY src ./src
RUN npm run build

FROM node:22-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev \
  && addgroup -g 10001 app \
  && adduser -D -u 10001 -G app app
COPY --from=build /app/dist ./dist
USER 10001:10001
ENTRYPOINT ["node", "/app/dist/bin.js"]
