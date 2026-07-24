FROM oven/bun:latest

WORKDIR /app

COPY package.json bun.lock tsconfig.json CHANGELOG.md bunfig.toml ./

RUN apt update && apt-get install -y fonts-liberation fontconfig
RUN bun install

COPY cli ./cli
COPY src ./src
COPY migrations ./migrations

CMD ["bun", "dev"]
