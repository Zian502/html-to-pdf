FROM mcr.microsoft.com/playwright:v1.61.0-noble

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=10000
ENV STORAGE_ROOT=/tmp/html-to-pdf

WORKDIR /app

RUN npm install --global pnpm@11.5.2

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod

COPY public ./public
COPY server ./server
COPY src ./src

RUN mkdir -p /tmp/html-to-pdf && chown -R pwuser:pwuser /tmp/html-to-pdf

USER pwuser

EXPOSE 10000

CMD ["node", "server/index.mjs"]
