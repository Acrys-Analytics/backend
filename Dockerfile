FROM node:16-alpine as builder

ENV NODE_ENV build
WORKDIR /app

COPY package*.json ./
COPY yarn.lock ./
COPY prisma ./prisma/

# Install all dependencies
RUN yarn install

# Copy all other files
COPY --chown=node:node . .

# Build and remove all devDependencies
RUN yarn run build \
    && yarn install --production


# NestJS Image
FROM node:16-alpine

ENV NODE_ENV production
WORKDIR /app

COPY --from=builder --chown=node:node /app/package*.json ./
COPY --from=builder --chown=node:node /app/yarn.lock ./
COPY --from=builder --chown=node:node /app/node_modules/ ./node_modules/
COPY --from=builder --chown=node:node /app/dist/ ./dist/

EXPOSE 3000
CMD ["yarn", "run", "start:prod"]