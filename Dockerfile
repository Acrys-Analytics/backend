FROM node:16-alpine as builder

ENV NODE_ENV build
USER node
WORKDIR /home/node

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
USER node
WORKDIR /home/node

COPY --from=builder --chown=node:node /home/node/package*.json ./
COPY --from=builder --chown=node:node /home/node/yarn.lock ./
COPY --from=builder --chown=node:node /home/node/node_modules/ ./node_modules/
COPY --from=builder --chown=node:node /home/node/dist/ ./dist/

EXPOSE 3000
CMD ["yarn", "run", "start:prod"]