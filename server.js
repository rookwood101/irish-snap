import path from "path"
import { fileURLToPath } from 'url';
import express from "express"
import { createServer } from "http"
import { Server } from "socket.io"

const app = express()
const server = createServer(app)
const io = new Server(server)

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const html = path.join(__dirname, "index.html")

app.get("/", (req, res) => {
  res.sendFile(html)
})

io.on("connection", (socket) => {
  console.log("a user connected")
  socket.on('disconnect', () => {
    console.log('user disconnected');
  });
})

server.listen(8000, () => {
  console.log("listening on *:8000")
})