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
const batabataNFTAddress = process.env.BATABATA_NFT;
const requireNFT = async (req, res, next) => {
  try {
    const { public } = req.user;
    const curBalance = await getBalance(batabataNFTAddress, public);
    console.log('nft balance', public, curBalance);
    // Need to have tokens in wallet
    if (curBalance >= process.env.BATABATA_BALANCE) next();
    else {
      return res.status(405).json({
        message: 'Please purchase Batabata NFT token in your wallet!'
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
