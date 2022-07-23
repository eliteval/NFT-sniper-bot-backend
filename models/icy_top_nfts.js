const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const icy_top_nfts = new Schema({
  contractAddress: { type: String },
  tokenID: { type: String },
  amount: { type: Number },
  originAmount: { type: Number },
  currency: { type: String },
  from: { type: String },
  to: { type: String },
  txHash: { type: String },
  platform: { type: String },
  timestamp: { type: Number },
  isSync: { type: Boolean },
  isLoading: { type: Boolean }
});

icy_top_nfts.set('toJSON', { getters: true });
icy_top_nfts.options.toJSON.transform = (doc, ret) => {
  const obj = { ...ret };
  delete obj.__v;
  return obj;
};
module.exports = mongoose.model('icy_top_nfts', icy_top_nfts);
