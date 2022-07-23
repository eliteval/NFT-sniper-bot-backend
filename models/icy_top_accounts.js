const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const icy_top_accounts = new Schema({
  contractAddress: { type: String },
  accountAddress: { type: String },
  mostHolding: { type: String },
  holdingValue: { type: Number },
  collectionCount: { type: Number },
  nftCount: { type: Number }, 
  isSync: { type: Boolean },
  isLoading: { type: Boolean }
});

icy_top_accounts.set('toJSON', { getters: true });
icy_top_accounts.options.toJSON.transform = (doc, ret) => {
  const obj = { ...ret };
  delete obj.__v;
  return obj;
};
module.exports = mongoose.model('icy_top_accounts', icy_top_accounts);
