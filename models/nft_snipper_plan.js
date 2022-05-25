const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const nft_snipper_plan = new Schema({
  owner: { type: String, required: true },
  private: { type: String, required: true }, //
  public: { type: String, required: true }, //
  eth: { type: Number, default: 0.05 }, //NFT price by ETH
  gasPrice: { type: Number, required: true }, // gwei
  gasLimit: { type: Number, required: true }, // number
  waitTime: { type: Number, default: 10 },
  delayMethod: { type: String, default: 'second' }, // block, second
  token: { type: String, default: '' }, //
  abi: { type: String, default: '[]' }, //
  tokenAmount: { type: Number }, //
  startFunction: { type: String, default: '' },
  mintFunction: { type: String, default: '' },
  funcRegex: { type: String },
  sniperTrigger:  { type: String, default: 'flipstate' }, // flipstate, statuschange, idrange
  saleStatus: { type: String}, 
  rangeStart: { type: Number },
  rangeEnd: { type: Number },
  created: { type: Date, default: Date.now },
  updatedAt: {
    type: Number
  }
});

nft_snipper_plan.set('toJSON', { getters: true });
nft_snipper_plan.options.toJSON.transform = (doc, ret) => {
  const obj = { ...ret };
  delete obj.__v;
  return obj;
};
module.exports = mongoose.model('nft_snipper_plan', nft_snipper_plan);
