require('dotenv').config();
const express = require('express');
const morgan = require('morgan');
const bodyParser = require('body-parser');
const cors = require('cors');
const mongoose = require('mongoose');
const config = require('./config');
const path=require("path");

const connect = (url) => {
  return mongoose.connect(url, config.db.options);
};

if (require.main === module) {
  const app = express();
  app.use(cors());
  app.options('*', cors());
  app.use(morgan('dev'));
  app.use(express.static(path.resolve(__dirname, "build")));
  app.use(bodyParser.urlencoded({ extended: false }));
  app.use(bodyParser.json());
  const server = app.listen(config.port);
  const io = require('socket.io')(server, {
    cors: {
      origin: "http://localhost:3000",
    }
  });
  require('./routes.js')(app, io);
  connect(config.db.prod);
  mongoose.connection.on('error', console.log);
  console.log('launched');
}

module.exports = { connect };
