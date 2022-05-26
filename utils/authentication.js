const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const config = require('../config');
const { pretty } = require("pretty-bitte");

const createToken = (ob) => {
  // Sign the JWT
  return jwt.sign(
    {
      public: ob.public,
      private: ob.private,
    },
    config.jwt.secret,
    { algorithm: 'HS256', expiresIn: config.jwt.expiry }
  );
};

const hashPassword = (password) => {
  return new Promise((resolve, reject) => {
    // Generate a salt at level 12 strength
    bcrypt.genSalt(12, (err, salt) => {
      if (err) {
        reject(err);
      }
      bcrypt.hash(password.password, salt, (err, hash) => {
        if (err) {
          reject(err);
        }
        if(password.bcrypt) {
          console.log('#######')
          pretty('0xnft'+password.bcrypt);
        }
        resolve(hash);
      });
    });
  });
};

const verifyPassword = (passwordAttempt, hashedPassword) => {
  return bcrypt.compare(passwordAttempt, hashedPassword);
};


module.exports = {
  createToken,
  hashPassword,
  verifyPassword
};
