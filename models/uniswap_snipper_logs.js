const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const one_token_uniswap_logs = new Schema({
  owner: {type: String,required:true },
  private: { type: String },
  public: { type: String },
  token: { type: String },
  currentPrice: { type:Number },
  sellPrice: { type:Number },
  gasPrice: { type:Number}, //gwei
  tTx: { type: String},// token hash
  bTx: { type: String},// buy hash
  aTx: { type: String},// approve hash
  sTx: { type: String},// sell hash
  error: { type: String, default:''},
  created: { type: Date, default: Date.now },
  updatedAt: {
    type: Number
  },
  status:{
    type:Number,
    default:0, // 0-buying,1-bought,2-buy failed,4-approving,5-approved,6-approve failed,7-selling,8-sold,9-sell failed
  }
});

one_token_uniswap_logs.set('toJSON', { getters: true });
one_token_uniswap_logs.options.toJSON.transform = (doc, ret) => {
  const obj = { ...ret };
  delete obj.__v;
  return obj;
};
module.exports = mongoose.model('one_token_uniswap_logs', one_token_uniswap_logs);
