# Easier to build against Alpine
FROM node:14.18-alpine as build

RUN apk --no-cache add g++ gcc libgcc libstdc++ linux-headers make python


# Contents of build will be copied in the next container
WORKDIR /app
COPY package.json .
COPY yarn.lock .

COPY . /app
RUN yarn install --immutable
# There is an issue with "yarn package" with npx .
ENV NODE_ENV production
RUN yarn build --prod --ignore-scripts --prefer-offline

# Runtime container...
RUN echo "...Building container runtime"
FROM node:14.18-alpine

ENV HOST 0.0.0.0
ENV PORT 3000
ENV RAZZLE_PUBLIC_DIR /app/build/public
ENV SVC_POSITION http://localhost:9500/api
ENV SVC_DATA http://localhost:9510/api

RUN mkdir /app
RUN chown node:node /app

COPY --chown=node:node --from=build /app/build /app/build
COPY --chown=node:node --from=build /app/node_modules /app/node_modules
COPY --chown=node:node --from=build /app/package.json /app/

USER node
WORKDIR /app
CMD [ "node", "build/server.js" ]
