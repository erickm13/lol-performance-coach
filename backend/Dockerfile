FROM denoland/deno:2.0.0

WORKDIR /app

COPY deno.json deno.lock* ./
COPY src ./src
COPY scripts ./scripts
COPY drizzle.config.ts ./

RUN deno cache src/main.ts

EXPOSE 8000

CMD ["deno", "run", "-A", "src/main.ts"]
