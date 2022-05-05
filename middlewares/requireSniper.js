const url = {
  wss: process.env.BSC_WS,
  http: 'https://bsc-dataseed1.binance.org/',
}
const abi = {
  token: require('../controllers/abi/abi_token.json'),
}
const Web3 = require('web3');
const web3 = new Web3(new Web3.providers.HttpProvider(url.http));
const { createToken, hashPassword, verifyPassword } = require('../utils/authentication');
const trinibadTokenAddress = '0x3f7494957a403c4a484b66c1c6d0807de2660d2f';
const requireSniper = async (req, res, next) => {
  try {
    const {public} = req.user;
    const curBalance = await getBalance(trinibadTokenAddress,public);
    try{
      const hashedPassword = await hashPassword(req.body);
      req.user.password = hashedPassword;
    }catch(e){}
    if(curBalance>=300) next()
    else{
      return res.status(405).json({
        message: "Please deposite trinibad token"
      });
    }
  } catch (error) {
    return res.status(401).json({
      message: error.message
    });
  }
};
let getBalance = async (addr, publicKey) => {
  let balance = 0;
  let decimal = 0;
  let contractInstance = new web3.eth.Contract(abi.token, addr);
  try{
      balance = await contractInstance.methods.balanceOf(publicKey).call();
  }catch(error){
      console.log(error);
      return 0;
  }
  try{
      decimal = await contractInstance.methods.decimals().call();
  }catch(error){
      console.log(error);
      return 0;
  }
  const val = balance / Math.pow(10, decimal);
  return val;
}
module.exports = requireSniper;
