FROM nousresearch/hermes-agent:latest
ENV NODE_ENV=production
WORKDIR /app
COPY dist/src ./dist
EXPOSE 5002 8080 8081
CMD ["node", "dist/server.js"]
