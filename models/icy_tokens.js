const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const icy_tokens = new Schema({
  token_address: { type: String },
  name: { type: String },
  symbol: { type: String },
  token_id: { type: Number },
  owner: { type: String },
  token_uri: { type: String },
  metadata: { type: Object },
  contract_type: { type: String },
  rarity_score: { type: Number },
  rarity_rank: { type: Number },
  isSync: { type: Boolean }
});

icy_tokens.set('toJSON', { getters: true });
icy_tokens.options.toJSON.transform = (doc, ret) => {
  const obj = { ...ret };
  delete obj.__v;
  return obj;
};
module.exports = mongoose.model('icy_tokens', icy_tokens);
