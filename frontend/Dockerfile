# frontend/Dockerfile
# Stage 1: build with Node 20 for Vite
FROM node:20-alpine AS build
WORKDIR /app

# copy package manifests first to leverage layer cache
COPY package*.json ./
RUN npm ci --silent

# copy source and build
COPY . .
RUN npm run build

# Stage 2: nginx serve built static files
FROM nginx:stable-alpine
# Vite default output dir is "dist"
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx/default.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
