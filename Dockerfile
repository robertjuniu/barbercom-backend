FROM node:24-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --chown=node:node src ./src
COPY --chown=node:node scripts ./scripts
COPY --chown=node:node database ./database
COPY --chown=node:node test ./test
COPY --chown=node:node views ./views
COPY --chown=node:node public ./public
RUN mkdir -p work && chown node:node work
USER node
EXPOSE 3000
CMD ["node", "scripts/iniciar-container.js"]
