FROM node:24.14.0-alpine AS deps

WORKDIR /app

RUN sed -i 's/dl-cdn.alpinelinux.org/mirrors.tuna.tsinghua.edu.cn/g' /etc/apk/repositories && \
    apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm config set registry https://registry.npmmirror.com && \
    npm ci --omit=dev && \
    npm cache clean --force

FROM node:24.14.0-alpine AS runner

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --chown=node:node . .

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

USER node

CMD ["npm", "run", "start"]
