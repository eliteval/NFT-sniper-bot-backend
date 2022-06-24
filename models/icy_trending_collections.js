const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const icy_trending_collections = new Schema({
  timeframe: { type: Number },
  address: { type: String },
  name: { type: String },
  symbol: { type: String },
  totalSales: { type: Number },
  average: { type: Number },
  ceiling: { type: Number },
  floor: { type: Number },
  volume: { type: Number },
  unsafeOpenseaImageUrl: { type: String },
  unsafeOpenseaSlug: { type: String },
  isSync: { type: Boolean },
  isLoading: { type: Boolean }
});

icy_trending_collections.set('toJSON', { getters: true });
icy_trending_collections.options.toJSON.transform = (doc, ret) => {
  const obj = { ...ret };
  delete obj.__v;
  return obj;
};
module.exports = mongoose.model('icy_trending_collections', icy_trending_collections);
