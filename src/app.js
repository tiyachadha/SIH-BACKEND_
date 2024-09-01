import express, { urlencoded } from "express"
import cors from "cors"
import cookieParser from "cookie-parser"
import { Server } from 'socket.io';
import http from 'http';

//
var mongoose = require("mongoose");

mongoose.connect("mongodb://127.0.0.1:27017/test");

const express = require("express");
//

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
  },
});

io.on('connection', (socket) => {
  console.log('A user connected');

  socket.on('cellUpdated', (data) => {
    console.log('Cell updated:', data);
    socket.broadcast.emit('cellUpdate', data);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected');
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});



app.use(cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true
}))

app.use(express.json({limit: "100kb"}))
app.use(urlencoded({extended: true, limit: "100kb"}))
app.use(express.static("public"))
app.use(cookieParser())


import userRouter from "./routes/user.routes.js"
import sheetRouter from "./routes/sheet.routes.js"

app.use("/api/v1/users", userRouter)
app.use("/api/v1/sheets", sheetRouter)

//
app.listen(3000,function(){
  console.log('app is running');
});
//

export {app}
