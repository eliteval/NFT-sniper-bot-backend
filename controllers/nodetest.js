const Web3 = require('web3')
const ethereum = new Web3(new Web3.providers.HttpProvider("http://45.77.189.205:8545"));
const public = '';
const private= '';
const testGeth = async ()=> {
    const bnb = await ethereum.eth.getBalance('0x4b951Ef558B95C53B6207Dc393b426E388F1E04F');
    console.log(bnb);
    const nonce=await ethereum.eth.getTransactionCount(public, 'latest');
    // console.log(value);
    let value=ethereum.utils.toWei('0.03', 'ether');
    // console.log(value);
    value=ethereum.utils.toBN(value).toString();
    // console.log(value);
    const rawTransaction = {
      "nonce": nonce,
      "gas": ethereum.utils.toHex(21000),
      "to": '0xa6ca5320d8f1cf9534804289d7fd4cec63d06bc8',
      "value": value,
      "chainId": 1 //remember to change this
    };
    console.log(rawTransaction);
    const signedTx = await ethereum.eth.accounts.signTransaction(rawTransaction, private);

    ethereum.eth.sendSignedTransaction(signedTx.rawTransaction, function(error, hash) {
    if (!error) {
      console.log("🎉 The hash of your transaction is: ", hash);
    } else {
      console.log("❗Something went wrong while submitting your transaction:", error)
    }
    });
}
testGeth()