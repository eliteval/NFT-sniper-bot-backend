const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const icy_trade_transactions = new Schema({
  address: { type: String },
  tokenID: { type: String },
  seller: { type: String },
  buyer: { type: String },
  price: { type: Number },
  tradeAt: { type: Date },
  marketplace: { type: String },
  transaction: { type: String },
  isSync: { type: Boolean },
});

icy_trade_transactions.set('toJSON', { getters: true });
icy_trade_transactions.options.toJSON.transform = (doc, ret) => {
  const obj = { ...ret };
  delete obj.__v;
  return obj;
};
module.exports = mongoose.model('icy_trade_transactions', icy_trade_transactions);
