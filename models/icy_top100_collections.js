const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const icy_top100_collections = new Schema({
  rank: { type: Number },
  contractAddress: { type: String },
  name: { type: String },
  symbol: { type: String },
  unsafeOpenseaImageUrl: { type: String },
  unsafeOpenseaSlug: { type: String },
  marketCap: { type: Number },
  holders: { type: Number },
  currency: { type: String },
  isSync: { type: Boolean },
  isLoading: { type: Boolean }
});

icy_top100_collections.set('toJSON', { getters: true });
icy_top100_collections.options.toJSON.transform = (doc, ret) => {
  const obj = { ...ret };
  delete obj.__v;
  return obj;
};
module.exports = mongoose.model('icy_top100_collections', icy_top100_collections);
