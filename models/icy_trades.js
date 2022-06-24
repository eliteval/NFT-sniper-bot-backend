const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const icy_trades = new Schema({
  address: { type: String },
  tokenID: { type: String },
  seller: { type: String },
  buyer: { type: String },
  price: { type: Number },
  tradeAt: { type: Date },
  marketplace: { type: String },
  transaction: { type: String },
  isSync: { type: Boolean },
  isLoading: { type: Boolean }
});

icy_trades.set('toJSON', { getters: true });
icy_trades.options.toJSON.transform = (doc, ret) => {
  const obj = { ...ret };
  delete obj.__v;
  return obj;
};
module.exports = mongoose.model('icy_trades', icy_trades);
