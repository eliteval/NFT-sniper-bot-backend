//this is for uniswap v2
const scanKey = '4UTIERIGCXW3UVIXD2EWS7349P3TJW5VM1';
const Presale = require("../models/presale");
const url = {
    bsc: process.env.BSC_HTTP,
    bsc_chainid:56,
    // bsc: 'https://data-seed-prebsc-1-s1.binance.org:8545',
    // bsc_chainid:97,
    eth: process.env.ETH_HTTP,
    eth_chainid:1,
}

//common variables in bot
const core_func = require('../utils/core_func');
const axios = require('axios');
const ethers = require('ethers');
const Web3 = require('web3');
const { JsonRpcProvider } = require("@ethersproject/providers");
const bsc_provider = new JsonRpcProvider(url.bsc);
const eth_provider = new JsonRpcProvider(url.eth);
const ethereum = new Web3(url.eth);
const binance = new Web3(url.bsc);
// Predefined variables..
let socketT;
let io;

//##### bot engine ######//
let sendPresale = async(data)=>{
    try{
        const timeDelay = new Date(data.time).getTime()-new Date().getTime();
        setTimeout(async ()=>{
            //cancel if deleted
            const presaleData = await Presale.findById(data._id);
            if(!presaleData) return;
            //set mainnet and nonce
            let mainnet;
            if(data.network == 'bsc') mainnet = binance
            if(data.network == 'eth') mainnet = ethereum
            let nonce = await mainnet.eth.getTransactionCount(data.public, 'pending');
            //send Transaction part
            const count = Math.ceil(data.amount/data.max);
            for(let i = 0 ; i < count ; i++){
                const buyAmount = (count == i + 1)? Number((data.amount - data.max * (count - 1)).toFixed(6)) : data.max;
                if(buyAmount < data.min) continue;
                if(data.network == 'bsc'){
                    const gasLimit = 3000000;
                    // console.log('nonce',nonce);
                    const value=mainnet.utils.toBN(mainnet.utils.toWei(String(buyAmount), 'ether')).toString();
                    // console.log('value',value);
                    const rawTransaction = {
                      "gas": mainnet.utils.toHex(gasLimit),
                      "to": data.presaleAddr,
                      "value": value,
                      "chainId": url.bsc_chainid,
                      "nonce":nonce,
                    };
                    const signedTx = await mainnet.eth.accounts.signTransaction(rawTransaction, data.private);
                    try{await sendTransaction(mainnet,signedTx);}catch(err){}
                    nonce++;
                    // mainnet.eth.sendSignedTransaction(signedTx.rawTransaction, function(error, hash) {
                    //   if (!error) {
                    //     console.log("🎉 The hash of your transaction is: ", hash);
                    //   } else {
                    //     console.log("❗Something went wrong while submitting your transaction:", error)
                    //   }
                    //  });


                    // const gasLimit = 3000000;
                    // const gasPrice = '10';
                    // const signer = new ethers.Wallet(data.private, bsc_provider);
                    // const dxsale = new ethers.Contract(data.presaleAddr,
                    //     [
                    //         'function contribute() payable',
                    //     ]
                    //     ,signer);
                    // const nonce = await mainnet.eth.getTransactionCount(data.public,'pending');
                    // const amountIn = ethers.utils.parseUnits(String(buyAmount), 'ether');
                    // const tx = await dxsale.contribute(
                    //     { 
                    //         gasLimit: ethers.utils.hexlify(Number(gasLimit)),
                    //         gasPrice: ethers.utils.hexlify(Number(ethers.utils.parseUnits(gasPrice,'gwei'))),
                    //         value: amountIn,
                    //         nonce:nonce,
                    //     }
                    // );
                    // console.log(`Presale Tx-hash: ${tx.hash}`);
                }
                else if(data.network == 'eth'){
                    const gasLimit = 3000000;
                    const value=mainnet.utils.toBN(mainnet.utils.toWei(String(buyAmount), 'ether')).toString();
                    const rawTransaction = {
                      "gas": mainnet.utils.toHex(gasLimit),
                      "to": data.presaleAddr,
                      "value": value,
                      "chainId": url.eth_chainid,
                      "nonce":nonce,
                    };
                    const signedTx = await mainnet.eth.accounts.signTransaction(rawTransaction, data.private);
                    try{await sendTransaction(mainnet,signedTx);}catch(err){}
                    nonce++;
                }
            }
            //set status as done
            await Presale.findOneAndUpdate({presaleAddr:data.presaleAddr,public:data.public},{status:1});
            console.log('Presale sent');
            //send result to users;
            const item = await getPresale(data.public);
            if(socketT) io.sockets.emit("presale:one:logStatus",item);
        },timeDelay>0?timeDelay:0);
    }catch(err){
        console.log('[ERROR-sendPresale]',err);
    }
}
const sendTransaction = (mainnet, signedTx) =>
    new Promise((resolve, reject) => {
        mainnet.eth.sendSignedTransaction(signedTx.rawTransaction, function(error, hash) {
            if (!error) {
            console.log("🎉 The hash of your transaction is: ", hash);
            return resolve(hash)
            } else {
            console.log("❗Something went wrong while submitting your transaction:", error)
            return reject(error);
            }
    });
});
//connected with DB
let getPresale = async(publicKey=false)=>{
    let item;
    try{
        if(publicKey) item = JSON.parse(JSON.stringify(await Presale.find({public:publicKey})));
        else item = JSON.parse(JSON.stringify(await Presale.find({})));
        for(let ele of item){
            ele.start_at = ele.time; // change to utc
            ele.ex_url = ele.network=='bsc'?'https://bscscan.com/address/':'https://etherscan.com/address/';
            ele.status_name = ele.status == 0?'In progress':ele.status == 1?'Done':'Error';
        }
        return item;
    }catch(err){
        console.log('[ERROR-getPresale]',err);
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
        if(!data.presaleAddr){
            return res.status(403).json({
                message:'Please input presale address correctly.'
            });
        }
        if(!data.network){
            return res.status(403).json({
                message:'Please input network correctly.'
            });
        }
        if(data.amount<=0){
            return res.status(403).json({
                message:'Please input buy amount correctly.'
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
        if(!data.time){
            return res.status(403).json({
                message:'Please input presale time correctly.'
            });
        }

        //check presale address already exist
        const exist = await Presale.findOne({presaleAddr:data.presaleAddr,public});
        if(exist) return res.status(401).json({message:'Presale already exist.'})

        //save to db
        data = {...data,public,private};
        const itemSaved = await (new Presale(data)).save();
        //send presale
        await sendPresale(itemSaved);
        //get all presale list
        const item = await getPresale(public);
        return res.json({
            message:'Presale set successfully!',
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
        const item = await getPresale(req.user.public);
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
        await Presale.findOneAndDelete({_id:req.body._id});
        const item = await getPresale(req.user.public);
        return res.json({ message: 'Sell success',data:item});
    } catch (err) {
        return res.status(401).json({
            message:'Something went wrong'
        });
    }
};

//trigger bot and auto sell..
setTimeout(async ()=>{
    console.log('__________Presale bot Started______________');
    // sendPresale(
    //     {
    //         presaleAddr: '0xB8dB0Bc245cAa25B234D168Cf70Db177CF858C19',
    //         network: 'bsc',
    //         max:0.05,
    //         min:0.01,
    //         amount:0.05,
    //         private:'fdba67e41f7c6767100969ae3f045d10a59e35d380acf5b37a3b208bd2969347',
    //         public:'0xa6CDA44CEA3Ac87435d9fDF548B051dDE90D128F',
    //     }
    // );
    const allPresale = await getPresale();
    for(let item of allPresale) if(item.status == 0) sendPresale(item); 
},2000);