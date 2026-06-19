FROM node:20-slim

WORKDIR /app

COPY package.json ./
RUN npm install

COPY . .

# Build the production bundle, then serve it with `vite preview`. Unlike the
# dev server, preview has NO HMR WebSocket, so the dashboard behaves the same on
# every PC no matter what host/IP/port the browser uses. The only live socket
# left is /api/live/ws, which is same-origin through the Caddy proxy.
RUN npm run build

EXPOSE 5173

CMD ["npm", "run", "preview", "--", "--host", "0.0.0.0", "--port", "5173"]
