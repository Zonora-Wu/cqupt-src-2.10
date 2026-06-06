FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --omit=optional

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:22-alpine AS runner
ENV NODE_ENV=production \
    RETEST_RUNNER_PORT=5015 \
    RETEST_RUNNER_MAX_BODY_BYTES=65536
WORKDIR /app
RUN addgroup -S retest && adduser -S retest -G retest
COPY package.json ./
COPY --from=build /app/dist ./dist
USER retest
EXPOSE 5015
CMD ["node", "dist/server.js"]
