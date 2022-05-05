const User = require('../models/user');
const { hashPassword } = require('../utils/authentication');
const mongoose = require('mongoose');
const config = require('../config');

const connect = (url) => {
  return mongoose.connect(url, config.db.options);
};
connect(config.db.prod);
(async ()=>{
  try{
    const hashedPassword = await hashPassword("asdASD123!@#");

    const userData = {
      username: 'user',
      password: hashedPassword
    };
    const newUser = new User(userData);
    const savedUser = await newUser.save();
    console.log("user created");
  }catch(err){
    console.log(err);
  }
})();
