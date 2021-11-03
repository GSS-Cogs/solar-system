FROM node:lts-alpine AS base
MAINTAINER Alex Tucker <alex@floop.org.uk>

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:lts-alpine AS release
COPY --from=base /app/node_modules /app/node_modules
COPY --from=base /app/package-lock.json /app/
EXPOSE 3000
WORKDIR /app
COPY . /app/
CMD npm start