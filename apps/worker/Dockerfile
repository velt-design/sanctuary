FROM node:22-bookworm-slim AS build

WORKDIR /workspace
COPY . .
RUN npm ci --ignore-scripts
RUN npm --prefix apps/worker run build

FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production
WORKDIR /app

COPY --from=build --chown=node:node /workspace/apps/worker/dist/ ./

USER node
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "const port=process.env.BACKGROUND_JOBS_WORKER_HEALTH_PORT||'8080';fetch('http://127.0.0.1:'+port+'/livez').then((response)=>{if(!response.ok)process.exit(1)}).catch(()=>process.exit(1))"

ENTRYPOINT ["node", "worker.mjs"]
