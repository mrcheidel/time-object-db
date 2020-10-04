FROM alpine:3.12
WORKDIR /app
COPY package.json package-lock.json config.json index.js README.md ./
COPY /lib ./lib
COPY /doc ./doc
COPY /data ./data

VOLUME /app/data
EXPOSE 8000/tcp

RUN apk add --update nodejs npm procps
RUN npm install 
CMD ["node", "index.js"]