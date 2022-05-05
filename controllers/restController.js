const Web3 = require('web3')
const jwtDecode = require('jwt-decode');
const { body, validationResult } = require('express-validator');
const { createToken, hashPassword, verifyPassword } = require('../utils/authentication');
const Wallet = require('../models/wallet');
const ethers = require("ethers");
exports.authenticate = async (req, res) => {
  try {
    const {public,password} = req.body;
    const existWallet = await Wallet.findOne({
      public:public
    });
    if(!existWallet){
      return res.status(403).json({
        message: 'Unknown acount!'
      });
    }
    const passwordValid = await verifyPassword(password, existWallet.password);
    if(passwordValid){
      const token = createToken({public:existWallet.public,private:existWallet.private});
      const decodedToken = jwtDecode(token);
      const expiresAt = decodedToken.exp;
      return res.json({
        message: 'Authentication successful!',
        token,
        userInfo:existWallet,
        expiresAt
      });
    }else{
      return res.status(403).json({
        message: 'Password is incorrect!'
      });
    }

  } catch (error) {
    console.log(error);
    return res.status(400).json({
      message: 'Something went wrong.'
    });
  }
};
exports.register = async (req, res) => {
  try {
    let walletData = await this.validate(req.body.private);
    if(walletData===false) {
      return res.status(403).json({
        message: 'Privatekey is not correct!'
      });
    }
    const {pu, pr} = walletData;
    const existWallet = await Wallet.findOne({
      private:pr
    });
    if(existWallet){
      return res.status(403).json({
        message: 'This account already exist!'
      });
    }else{
      const hashedPassword = await hashPassword(req.body);
      await (new Wallet({public:pu,private:pr,password:hashedPassword})).save();
      return res.json({
        message:'Registered successfully!'
      })
    }
  } catch (error) {
    console.log(error);
    return res.status(400).json({
      message: 'Something went wrong.'
    });
  }
};
exports.changePassword = async (req, res, next) => {
  const password = req.body.password;
  const newPassword = req.body.newPassword;
  let user = await Wallet.findOne({public:req.body.publickey});
  if(!user){
    return res.status(401).json({ error: 'Public key is incorrect' });
  }
  const passwordValid = await verifyPassword(password, user.password);
  if (passwordValid) {
    const hashedPassword = await hashPassword({password:newPassword});
    await Wallet.findOneAndUpdate({public:req.body.publickey},{password:hashedPassword});
    return res.status(200).json({
      message: 'Password changed!'
    });
  } else return res.status(401).json({ error: 'Password incorrect!' });
};
exports.validate = async (val) => {
  try{
    let w = new ethers.Wallet(val);
    return {pu:w.address,pr:val};
  }catch(error){
    return false;
  }
}
exports.validateRegister = [
  body('private')
    .exists()
    .trim()
    .withMessage('is required')

    .notEmpty()
    .withMessage('cannot be blank'),

  body('password')
    .exists()
    .trim()
    .withMessage('is required')

    .notEmpty()
    .withMessage('cannot be blank')

    .isLength({ min: 6 })
    .withMessage('must be at least 6 characters long')

    .isLength({ max: 50 })
    .withMessage('must be at most 50 characters long')
];