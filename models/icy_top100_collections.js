const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const icy_top100_collections = new Schema({
  rank: { type: Number },
  iconUrl: { type: String },
  contractName: { type: String },
  productPath: { type: String },
  baseCurrency: { type: String },
  isSalesOnly: { type: Boolean },
  value: { type: Number },
  valueUSD: { type: Number },
  platform: { type: Number },
  buyers: { type: Number },
  sellers: { type: Number },
  owners: { type: Number },
  transactions: { type: Number },
  changeInValueUSD: { type: Number },
  previousValue: { type: Number },
  previousValueUSD: { type: Number },
  isSlamLandDisabled: { type: Boolean },
});

icy_top100_collections.set('toJSON', { getters: true });
icy_top100_collections.options.toJSON.transform = (doc, ret) => {
  const obj = { ...ret };
  delete obj.__v;
  return obj;
};
module.exports = mongoose.model('icy_top100_collections', icy_top100_collections);
