//bot mode
const title = 'NFT snipper';

//DB
const Plan = require('../models/nft_snipper_plan');
const Logs = require('../models/nft_snipper_logs');
const Wallet = require('../models/wallet');

//EndPoint, abi, address, socket, plan lists
const url = {
  wss: process.env.ETH_WS,
  http: process.env.ETH_HTTP
};
// const url = {
//   wss: process.env.BSC_WS,
//   http: process.env.BSC_HTTP
// };
const address = {
  WRAPCOIN: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
  router: '0x10ED43C718714eb63d5aA57B78B54704E256024E'
};
const abi = {
  router: require('./abi/abi_uniswap_v2_router_all.json'),
  token: require('./abi/abi_token.json'),
  nft: require('./abi/abi_nft.json')
};
const approveGas = 8; // this is default gas in mainnet...
let socketT;
let io;
let planList = []; // array of all plans user set

//common variables in bot
const core_func = require('../utils/core_func');
const axios = require('axios');
const ethers = require('ethers');
const { BigNumber } = require('ethers');
const { JsonRpcProvider } = require('@ethersproject/providers');
const wssprovider = new ethers.providers.WebSocketProvider(url.wss);
const httpprovider = new JsonRpcProvider(url.http);
const provider = httpprovider;
const Web3 = require('web3');
const web3 = new Web3(new Web3.providers.HttpProvider(url.http));
const web3_wss = new Web3(new Web3.providers.WebsocketProvider(url.wss));
const uniswapAbi = new ethers.utils.Interface(abi.router);

//Start Functions
let initMempool = async () => {
  await prepareBot(); // set variables that bot will use....
  wssprovider.on('pending', (tx) => {
    wssprovider
      .getTransaction(tx)
      .then(function (transaction) {
        try {
          if (transaction && planList.length > 0) {
            const planListTemp = JSON.parse(JSON.stringify(planList));
            for (let i = 0; i < planListTemp.length; i++) {
              const plan = planListTemp[i];
              if (
                plan.sniperTrigger == 'flipstate' &&
                checkFlipStateTransaction(plan.token, plan.funcRegex, transaction) === true
              ) {
                console.log('Flipstate detected: ', transaction.hash);
                try {
                  planList.splice(i, 1);
                  setTimeout(() => {
                    mintNFTToken(
                      plan,
                      plan.token,
                      plan.abi,
                      plan.mintFunction,
                      plan.eth,
                      plan.tokenAmount,
                      plan.gasPrice,
                      plan.public,
                      plan.private
                    );
                  }, plan.waitTime * 1000);
                } catch (error) {
                  console.log('[ERROR->mintNFT when flipstate]', error);
                }
              }
            }
          }
        } catch (e) {
          console.log('[ERROR]->WSSProvider->getTransaction function');
        }
      })
      .catch((error) => {
        console.log('[ERROR in WSSprovider]', error);
      });
  });
};
//check if transaction calls the contract's method
let checkFlipStateTransaction = (contract_address, funcRegex, transaction) => {
  try {
    if (
      String(transaction.to).toLowerCase() == String(contract_address).toLowerCase() &&
      new RegExp(`^${funcRegex}`).test(transaction.data)
    )
      return true;
    else return false;
  } catch (err) {
    console.log('[ERROR->checkTransaction]', err);
    return false;
  }
};
//check NFT contract variable
let callContractViewFunction = async (contract_address, contract_abi, variable_name) => {
  try {
    const contractInstance = new web3.eth.Contract(JSON.parse(contract_abi), contract_address);
    var result = await contractInstance.methods[variable_name]().call();
    return result;
  } catch (err) {
    console.log('[ERROR->call Contract ViewFunction]', err.message);
    return -1;
  }
};
//make NFT contract ABI
let makeContractABI = (saleStatus, mintFunction) => {
  var ttt = JSON.parse(JSON.stringify(require('./abi/abi_nft.json')));
  ttt[0]['name'] = saleStatus ? saleStatus : 'statusVariable';
  ttt[1]['name'] = mintFunction ? mintFunction : 'mintFunction';
  return JSON.stringify(ttt);
};

let mintNFTToken = async (
  plan,
  contract_address,
  contract_abi,
  mint_function,
  token_price,
  token_amount,
  gas_price,
  public_key,
  private_key
) => {
  await Plan.findByIdAndDelete(plan._id);
  await prepareBot(true);

  try {
    const value = ethers.utils.parseUnits(String(token_price * token_amount), 'ether');
    const contractInstance = new web3.eth.Contract(JSON.parse(contract_abi), contract_address);
    // var gasLimit = await contractInstance.methods.publicMint(1)
    //   .estimateGas({ from: public_key, value: String(value) });
    var gasLimit = await contractInstance.methods[mint_function](token_amount).estimateGas({
      from: public_key,
      value: String(value)
    });

    var gasTx = {
      gasLimit: ethers.utils.hexlify(Number(gasLimit)),
      gasPrice: ethers.utils.hexlify(Number(ethers.utils.parseUnits(String(gas_price), 'gwei'))),
      value: value
    };

    const signer = new ethers.Wallet(private_key, provider);
    const nftcontract = new ethers.Contract(contract_address, JSON.parse(contract_abi), signer);
    var tx = await nftcontract[mint_function](token_amount, gasTx);
    console.log('mint NFTToken: ', tx.hash);
    await Logs.create({
      owner: plan.owner,
      public: plan.public,
      contract: plan.token,
      trigger: makeTriggerString(plan),
      mintFunction: plan.mintFunction,
      tokenPrice: plan.eth,
      tokenAmount: token_amount,
      gasPrice: plan.gasPrice,
      status: 1,
      tx: tx.hash
    });
  } catch (error) {
    console.log('mintNFT error: ', error);
    await Logs.create({
      owner: plan.owner,
      public: plan.public,
      contract: plan.token,
      trigger: makeTriggerString(plan),
      mintFunction: plan.mintFunction,
      tokenPrice: plan.eth,
      tokenAmount: token_amount,
      gasPrice: plan.gasPrice,
      status: 2,
      error: error
    });
  }
};
let makeTriggerString = (plan) => {
  let trigger;
  if (plan.sniperTrigger == 'flipstate') {
    trigger = `Mint when "${plan.startFunction}" is called`;
  } else if (plan.sniperTrigger == 'statuschange') {
    trigger = `Mint when "${plan.saleStatus}" becomes true`;
  } else if (plan.sniperTrigger == 'idrange') {
    trigger = `Mint from #${plan.rangeStart} token to #${plan.rangeEnd} token`;
  }
  return trigger;
};
//____________functions___________________
let getEncode = (funcName) => {
  try {
    return web3.eth.abi.encodeFunctionSignature(String(funcName).replace(/ /g, ''));
  } catch (err) {
    // console.log('[ERROR->getEncode]')
    return false;
  }
};
let getBalance = async (addr, publicKey) => {
  try {
    const contractInstance = new web3.eth.Contract(abi.token, addr);
    const balance = await contractInstance.methods.balanceOf(publicKey).call();
    return balance;
  } catch (error) {
    console.log(error);
    return 0;
  }
};
let getAmountOut = async (amount, unitAddr, tokenAddr) => {
  // return eth amount not gwei
  try {
    const contractInstance = new web3.eth.Contract(abi.router, address.router);
    const amountOuts = await contractInstance.methods
      .getAmountsOut(amount, [tokenAddr, unitAddr])
      .call();
    return web3.utils.fromWei(String(amountOuts[1]));
  } catch (error) {
    console.log('[ERROR->getAmountOut]', error); // have to think about this.
    return 0;
  }
};
//##################### Link part with backend and front end
//##########################################################
let prepareBot = async (sendSocket = false) => {
  planList = await getOrderedPlans(); // set all plan list
  console.log(`@@ plans updates, ${planList.length} plans`, sendSocket);
  if (!sendSocket) {
    console.log(`|---------------${title} PlanList--------------|`);
    const structDatas = [];
    for (let i = 0; i < planList.length; i++) {
      structDatas.push({ User: planList[i].public, NFT: planList[i].token });
    }
    console.table(structDatas);
  }
  if (io && sendSocket) {
    console.log('socket sent');
    io.sockets.emit('nftsniper:planlist', planList);
  }
};
//connected with DB
let getOrderedPlans = async () => {
  //-tested
  try {
    const item = JSON.parse(JSON.stringify(await Plan.find({})));
    return item;
  } catch (err) {
    console.log('[Error in allPlan]');
    return [];
  }
};
let getPlan = async (publicKey) => {
  try {
    let item = JSON.parse(JSON.stringify(await Plan.find({ public: publicKey })));
    return item;
  } catch (err) {
    console.log('[Error in get plan]');
    return [];
  }
};

//connected with router
exports.setSocket = (ioOb, socket) => {
  io = ioOb;
  socketT = socket;
};
exports.getBots = async (req, res) => {
  const item = await Wallet.find({}, { _id: 0, password: 0, isBlocked: 0 });
  return res.json(item);
};
exports.readAllPlans = async (req, res) => {
  const item = await Plan.find({}, { private: 0 });
  return res.json(item);
};
exports.readAllLogs = async (req, res) => {
  const item = await Logs.find({}, { private: 0 });
  return res.json(item);
};
exports.addBot = async (req, res) => {
  //-tested
  try {
    const getW = (val) => {
      try {
        let w = new ethers.Wallet(val);
        return { pu: w.address, pr: val };
      } catch (error) {
        return false;
      }
    };
    let funcRegex = '';
    const data = req.body;
    //validate input parameters
    if (String(data.startFunction).replace(/ /g, '')) {
      const getEncodedResult = getEncode(data.startFunction);
      if (getEncodedResult) {
        funcRegex = getEncodedResult;
      } else {
        return res.status(403).json({
          message: 'Can not get Hexcode from snipper function you input...'
        });
      }
    }
    //contract abi
    let abi = makeContractABI(data.saleStatus, data.mintFunction);

    if (!data.token) {
      return res.status(403).json({
        message: 'Please input sniperToken address.'
      });
    }
    if (data.gasPrice <= 0) {
      return res.status(403).json({
        message: 'Please input gasPrice correctly.'
      });
    }
    if (data.gasLimit <= 0) {
      return res.status(403).json({
        message: 'Please input gasLimit correctly.'
      });
    }
    if (data.eth <= 0) {
      return res.status(403).json({
        message: 'Please input sniper amount correctly.'
      });
    }
    if (data.tokenAmount <= 0) {
      return res.status(403).json({
        message: 'Please input token amount correctly.'
      });
    }
    //add data
    if (data._id) {
      const { public, private } = data;
      const saveData = {
        token: String(data.token).trim().replace(/ /g, '').toLowerCase(),
        abi: abi,
        startFunction: String(data.startFunction).replace(/ /g, ''),
        mintFunction: String(data.mintFunction).replace(/ /g, ''),
        funcRegex: funcRegex,
        owner: req.user.public,
        private: private,
        public: public,
        waitTime: Math.floor(Number(data.waitTime)),
        delayMethod: data.delayMethod,
        eth: data.eth,
        tokenAmount: data.tokenAmount,
        gasPrice: data.gasPrice,
        gasLimit: data.gasLimit,
        sniperTrigger: data.sniperTrigger,
        saleStatus: data.saleStatus,
        rangeStart: data.rangeStart,
        rangeEnd: data.rangeEnd
      };
      await Plan.findOneAndUpdate({ _id: data._id }, saveData);
    } else {
      const { public, private } = req.user;

      const wallets = [
        {
          public,
          private
        }
      ];
      if (data.extraWallet) {
        const ext = String(data.extraWallet).replace(/ /g, '').split(',');
        for (let i = 0; i < ext.length; i++) {
          const w = getW(ext[i]);
          if (!w) continue;
          wallets.push({ public: w.pu, private: w.pr });
        }
      }
      for (let i = 0; i < wallets.length; i++) {
        await Plan.deleteMany({
          public: wallets[i].public,
          token: String(data.token).toLowerCase()
        });
        const saveData = {
          token: String(data.token).trim().replace(/ /g, '').toLowerCase(),
          abi: abi,
          startFunction: String(data.startFunction).replace(/ /g, ''),
          mintFunction: String(data.mintFunction).replace(/ /g, ''),
          funcRegex: funcRegex,
          owner: req.user.public,
          private: wallets[i].private,
          public: wallets[i].public,
          waitTime: Math.floor(Number(data.waitTime)),
          delayMethod: data.delayMethod,
          eth: data.eth,
          tokenAmount: data.tokenAmount,
          gasPrice: data.gasPrice,
          gasLimit: data.gasLimit,
          sniperTrigger: data.sniperTrigger,
          saleStatus: data.saleStatus,
          rangeStart: data.rangeStart,
          rangeEnd: data.rangeEnd
        };
        await new Plan(saveData).save();
      }
    }
    const item = await getPlan(req.user.public);
    await prepareBot(true);
    return res.json({
      message: 'Set bot successfully',
      data: item
    });
  } catch (err) {
    console.log('[ERROR->SETBOT]', err);
    return res.status(401).json({
      message: 'Setting bot failed'
    });
  }
};
exports.delBot = async (req, res) => {
  //-tested
  try {
    const { _id } = req.body;
    await Plan.findOneAndDelete({ _id: _id });
    await prepareBot(true);
    const item = await getPlan(req.user.public);
    return res.json({
      message: 'Successfully deleted!',
      data: item
    });
  } catch (err) {
    console.log('[ERROR->DELBOT]', err);
    return res.status(401).json({
      message: 'Setting bot failed'
    });
  }
};
exports.readPlan = async (req, res) => {
  try {
    const item = await getPlan(req.user.public);
    return res.json({
      data: item
    });
  } catch (err) {
    return res.status(401).json({
      message: 'Read failed'
    });
  }
};
exports.readLog = async (req, res) => {
  try {
    let item = JSON.parse(JSON.stringify(await Logs.find({ public: req.user.public })));
    return res.json({
      data: item
    });
  } catch (err) {
    return res.status(401).json({
      message: 'Read Logs failed'
    });
  }
};

function convertToHex(value) {
  let number = Number(value);
  let decimal = 0;
  while (1) {
    if (number < 10) {
      return ethers.utils
        .parseUnits(String(Number(number).toFixed(decimal)), decimal)
        .toHexString();
    } else {
      number = number / 10;
      decimal++;
    }
  }
}
//trigger start..
setTimeout(async () => {
  console.log(`__________${title} Started______________ `);
  initMempool();
}, 3000);

//check plan with ID range
(async () => {
  setInterval(async () => {
    if (planList.length > 0) {
      var planListTemp = JSON.parse(JSON.stringify(planList));
      for (let i = 0; i < planListTemp.length; i++) {
        var plan = planListTemp[i];

        if (plan.sniperTrigger == 'statuschange') {
          var saleStatus = await callContractViewFunction(plan.token, plan.abi, plan.saleStatus);
          if (saleStatus === true) {
            try {
              planList.splice(i, 1);
              mintNFTToken(
                plan,
                plan.token,
                plan.abi,
                plan.mintFunction,
                plan.eth,
                plan.tokenAmount,
                plan.gasPrice,
                plan.public,
                plan.private
              );
            } catch (error) {
              console.log('[ERROR->mintNFT when statuschange]', error);
            }
          }
        }

        if (plan.sniperTrigger == 'idrange') {
          var totalsupply = await callContractViewFunction(plan.token, plan.abi, 'totalSupply');
          // console.log(totalsupply);
          if (totalsupply >= plan.rangeStart - 1 && totalsupply <= plan.rangeEnd - 1) {
            var new_amount = plan.rangeEnd - totalsupply;
            try {
              planList.splice(i, 1);
              mintNFTToken(
                plan,
                plan.token,
                plan.abi,
                plan.mintFunction,
                plan.eth,
                new_amount,
                plan.gasPrice,
                plan.public,
                plan.private
              );
            } catch (error) {
              console.log('[ERROR->mintNFT when idrange]', error);
            }
          } else if (totalsupply >= plan.rangeEnd) {
            await Plan.findByIdAndDelete(plan._id);
            await prepareBot(true);
            await Logs.create({
              owner: plan.owner,
              public: plan.public,
              contract: plan.token,
              trigger: makeTriggerString(plan),
              mintFunction: plan.mintFunction,
              tokenPrice: plan.eth,
              tokenAmount: plan.tokenAmount,
              gasPrice: plan.gasPrice,
              status: 2,
              error: 'Target token number range is already passed.'
            });
          }
        }
      }
    }
  }, 20 * 1000);
})();
