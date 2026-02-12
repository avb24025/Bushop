# Update from v1.41.0 to v1.58.2
FROM mcr.microsoft.com/playwright:v1.58.2-jammy

WORKDIR /app

# The rest of your Dockerfile stays the same
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 5000
CMD ["npm", "start"]