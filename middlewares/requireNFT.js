const url = {
  wss: process.env.ETH_WS,
  http: process.env.ETH_HTTP
};
// const url = {
//   wss: process.env.BSC_WS,
//   http: process.env.BSC_HTTP
// };
const abi = {
  nft: require('../controllers/abi/abi_nft.json')
};
const Web3 = require('web3');
const web3 = new Web3(new Web3.providers.HttpProvider(url.http));
const Authorization = require('../models/authorization');
const Setting = require('../models/setting');
const Wallet = require('../models/wallet');

const requireNFT = async (req, res, next) => {
  try {
    const { public } = req.user;
    //check if user is admin
    const userRecord = await Wallet.findOne({ public: public });
    if (
      userRecord.isAdmin ||
      public == process.env.ADMIN_ADDRESS ||
      public == process.env.DEV_ADDRESS
    ) {
      next();
      return;
    }
    //check if has to check auth
    const record = await Setting.findOne({ key: 'checkAuth' });
    const checkAuth = record?.value;
    if (!checkAuth) {
      next();
      return;
    }
    //check balances of every NFT
    var passed = false;
    const items = await Authorization.find({});
    await Promise.all(
      items.map(async (item, key) => {
        var balance = await getBalance(item.address, public);
        if (balance >= item.amount) passed = true;
      })
    );
    if (passed) {
      next();
      return;
    } else {
      return res.status(405).json({
        message: 'Please purchase authorization NFT tokens in your wallet!'
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
  let contractInstance = new web3.eth.Contract(abi.nft, addr);
  try {
    balance = await contractInstance.methods.balanceOf(publicKey).call();
  } catch (error) {
    console.log(error);
    return 0;
  }
  return balance;
};
module.exports = requireNFT;
