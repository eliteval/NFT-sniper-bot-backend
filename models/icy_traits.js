const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const icy_traits = new Schema({
  address: { type: String },
  type: { type: String },
  value: { type: String },
  amount: { type: Number },
  rarity: { type: Number },
  isSync: { type: Boolean },
  isLoading: { type: Boolean },
  kind: { type: String }
});

icy_traits.set('toJSON', { getters: true });
icy_traits.options.toJSON.transform = (doc, ret) => {
  const obj = { ...ret };
  delete obj.__v;
  return obj;
};
module.exports = mongoose.model('icy_traits', icy_traits);
