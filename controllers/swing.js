const Swing = require("../models/swing");
const url = {
    bsc: process.env.BSC_RPC_URL,
    // bsc: 'https://data-seed-prebsc-1-s1.binance.org:8545',
}
const abi = {
    token: require('./abi/abi_token.json'),
    router: require('./abi/abi_uniswap_v2_router_all.json'),
}
const address = {
    busd:'0xe9e7cea3dedca5984780bafc599bd69add087d56',
    bsc_base: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
    // bsc_base: '0xae13d989dac2f0debff460ac112a837c89baa7cd',
    bsc_test_usdt: '0x7ef95a0FEE0Dd31b22626fA2e10Ee6A223F8a684',
    bsc_router: '0x10ED43C718714eb63d5aA57B78B54704E256024E',
    // bsc_router: '0x9Ac64Cc6e4415144C455BD8E4837Fea55603e5c3',
};
//common variables in bot
const core_func = require('../utils/core_func');
const axios = require('axios');
const ethers = require('ethers');
const Web3 = require('web3');
const { JsonRpcProvider } = require("@ethersproject/providers");
const bsc_provider = new JsonRpcProvider(url.bsc);
const bsc_web3 = new Web3(url.bsc);
// Predefined variables..
let socketT;
let io;
let gas={
    approve:5,approveLimit:1000000,buy:5,buyLimit:4000000
};
//##### bot engine ######//
let sendSwing = async(data)=>{
    try{
        const startSwing = async (botdata) => {
            //send Transaction part
            const amountToSwing = between(botdata.min*1000,botdata.max*1000)/1000;
            //set transaction count
            if(botdata.count%2==0){//buy
                const status = await buyTokens(bsc_provider,bsc_web3,address.bsc_router,botdata.addr,address.bsc_base,botdata.public,botdata.private,amountToSwing,gas.buy,gas.buyLimit)
                if(status) await Swing.findOneAndUpdate({addr:botdata.addr,public:botdata.public},{count:botdata.count+1,status:botdata.status==0?1:0});

            }else{//sell
                const approved = await approveTokens(bsc_provider,bsc_web3,address.bsc_router,botdata.addr,address.bsc_base,botdata.public,botdata.private,gas.approve,gas.approveLimit);
                await core_func.sleep(3*1000);
                if(approved){
                    const status = await sellTokens(bsc_provider,bsc_web3,address.bsc_router,botdata.addr,address.bsc_base,botdata.public,botdata.private,gas.buy,gas.buyLimit,botdata.slippage);
                    if(status) await Swing.findOneAndUpdate({addr:botdata.addr,public:botdata.public},{count:botdata.count+1,status:botdata.status==0?1:0});
                }
            }
            //send result to users;
            const item = await getSwing(botdata.public);
            if(socketT) io.sockets.emit("swing:one:logStatus",item);
        }
        while(1){
            //cancel if deleted
            const swingData = await Swing.findById(data._id);
            if(!swingData) {
                console.log('stoped bot');
                return;
            }
            await startSwing(swingData);
            await core_func.sleep(data.interval*1000);
        }
    }catch(err){
        console.log('[ERROR-sendSwing]',err);
    }
}
let buyTokens = async (provider,web3,routerAddress,tokenAddress,baseToken,public,private,value,gasPrices,gasLimits)=>{// checked
    try{
        const amountIn = ethers.utils.parseUnits(String(value), 'ether');
        const signer = new ethers.Wallet(private, provider);
        const router = new ethers.Contract(routerAddress,abi.router,signer);
        const nonce = await web3.eth.getTransactionCount(public,'pending');
        const gasTx={ 
            gasLimit: ethers.utils.hexlify(Number(gasLimits)),
            gasPrice: ethers.utils.hexlify(Number(ethers.utils.parseUnits(String(gasPrices), "gwei"))),
            value: amountIn,
            nonce:nonce,
        }
        let tx;
        tx = await router.swapExactETHForTokens(
            '0',
            [baseToken, tokenAddress],
            public,
            Date.now() + 10000 * 60 * 10, //100 minutes
            gasTx
        );
        tx.hash;
        console.log(`|*********** Buy Tx-hash: ${tx.hash}`);
        const receipt = await tx.wait();
        console.log(`|***********Buy Tx was mined in block: ${receipt.blockNumber}`);
        return true;
    }catch(error){
        console.log('[ERROR->buyTokens]',error)
        return false;
    }
}
let approveTokens = async (provider,web3,routerAddress,tokenAddress,baseToken,public,private,gasPrices,gasLimits)=>{ // checked
    try{
        console.log('~~~~~~~~~~~~~~~~~[Approve]~~~~~~~~~~~~~~~~~');
        const signer = new ethers.Wallet(private, provider);
        const contract = new ethers.Contract(tokenAddress, abi.token, signer);
        const balanceR = await contract.balanceOf(public);
        if(Number(balanceR)==0){
            return false;
        }
        const gasPrice = ethers.utils.hexlify(Number(ethers.utils.parseUnits(String(gasPrices), "gwei")));
        const gasLimit = ethers.utils.hexlify(Number(gasLimits));
        const tx = await contract.approve(routerAddress, balanceR, {gasLimit: gasLimit, gasPrice: gasPrice});
        console.log(`|*********** Approve Tx-hash: ${tx.hash}`);
        const receipt = await tx.wait();
        console.log(`|*********** Approve Tx was mined in block: ${receipt.blockNumber}`);
        console.log(`>>>> arrove balance`,balanceR);
        return true;
    }catch(error){
        console.log('[ERROR->swap approve]',error);
        return false;
    }
}
let sellTokens = async (provider,web3,routerAddress,tokenAddress,baseToken,public,private,gasPrices,gasLimits,slippage)=>{ //checked
    try{
        const signer = new ethers.Wallet(private, provider);
        const contract = new ethers.Contract(tokenAddress, abi.token, signer);
        const balanceR = await contract.balanceOf(public);
        const router = new ethers.Contract(routerAddress,abi.router,signer);
        const nonce = await web3.eth.getTransactionCount(public,'pending');
        const gasPrice = ethers.utils.hexlify(Number(ethers.utils.parseUnits(String(gasPrices), "gwei")));
        const gasLimit = ethers.utils.hexlify(Number(gasLimits));

        const amounts = await router.getAmountsOut(balanceR, [tokenAddress, baseToken]);
        const amountOutMin = amounts[1].sub(amounts[1].div(Number(slippage))); // slippage as 25%
        const tx = await router.swapExactTokensForETHSupportingFeeOnTransferTokens(
            balanceR,
            '0',
            [tokenAddress, baseToken],
            public,
            Date.now() + 1000 * 60 * 10, //10 minutes(deadline as)
            { gasLimit: gasLimit, gasPrice: gasPrice,nonce:nonce,}
        );
        console.log(`Sell Tx-hash: ${tx.hash}`);
        const receipt = await tx.wait();
        console.log(`Sell Tx was mined in block: ${receipt.blockNumber}`);
        return true;
    }catch(error){
        console.log('[ERROR->sellTokens]',error);
        return false;
    }
}
function between(min, max) {  
    return Math.floor(
      Math.random() * (max - min) + min
    )
}
//connected with DB
let getSwing = async(publicKey=false)=>{
    let item;
    try{
        if(publicKey) item = JSON.parse(JSON.stringify(await Swing.find({public:publicKey})));
        else item = JSON.parse(JSON.stringify(await Swing.find({})));
        for(let ele of item){
            ele.start_at = ele.time; // change to utc
            ele.ex_url = 'https://bscscan.com/address/';
            ele.status_name = ele.status == 0?'In progress':ele.status == 1?'Done':'Error';
        }
        return item;
    }catch(err){
        console.log('[ERROR-getSwing]',err);
        return [];
    }
}

//connected with router
exports.setSocket = (ioOb, socket) => {
    io = ioOb;
    socketT = socket;
}
exports.add = async (req, res) => {
    try {
        const {public,private} = req.user;
        let data = req.body;
        //check body data
        if(!data.addr){
            return res.status(403).json({
                message:'Please input contract address correctly.'
            });
        }
        if(data.min<=0){
            return res.status(403).json({
                message:'Please input Minimum Buy amount correctly.'
            });
        }
        if(data.max<=data.min){
            return res.status(403).json({
                message:'Maximum buy should be bigger that Minimum Buy amount.'
            });
        }
        if(data.interval <= 0){
            return res.status(403).json({
                message:'Please input interval time correctly.'
            });
        }

        //check address already exist
        const exist = await Swing.findOne({addr:data.addr,public});
        if(exist) return res.status(401).json({message:'Swing token already exist.'})

        //save to db
        data = {...data,public,private};
        const itemSaved = await (new Swing(data)).save();
        //send swing
        sendSwing(itemSaved);
        //get all swing list
        const item = await getSwing(public);
        return res.json({
            message:'Swing set successfully!',
            data:item,
        })
    } catch (err) {
        console.log('[ERROR-add]',err)
        return res.status(401).json({
            message:'Setting bot failed'
        });
    }
};
exports.read = async (req, res) => {
    try {
        const item = await getSwing(req.user.public);
        return res.json({
            data:item,
        })
    } catch (err) {
        return res.status(401).json({
            message:'Something went wrong'
        });
    }
};
exports.del = async (req, res) => {
    try {
        await Swing.findOneAndDelete({_id:req.body._id});
        const item = await getSwing(req.user.public);
        return res.json({ message: 'Sell success',data:item});
    } catch (err) {
        return res.status(401).json({
            message:'Something went wrong'
        });
    }
};

//trigger bot and auto sell..
setTimeout(async ()=>{
    console.log('__________Swing bot Started______________');
    const allSwing = await getSwing();
    for(let item of allSwing) sendSwing(item); 
},2000);