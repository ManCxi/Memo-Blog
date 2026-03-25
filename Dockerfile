FROM node:24.14.0-alpine AS deps

WORKDIR /app

RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

FROM node:24.14.0-alpine AS runner

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --chown=node:node . .

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

USER node

CMD ["npm", "run", "start"]
