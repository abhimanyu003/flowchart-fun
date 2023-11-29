FROM node:18-alpine as base
RUN npm i -g pnpm
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /app
COPY . /app

EXPOSE 3000
CMD ["npm", "run", "dev"]