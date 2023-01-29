FROM node:14-alpine
LABEL fly_launch_runtime="nodejs"
WORKDIR /app
ENV NODE_ENV production

COPY package.json package-lock.json ./
RUN npm ci && npm cache clean --force

COPY . .
CMD [ "npm", "run", "start" ]
