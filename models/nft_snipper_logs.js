const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const nft_snipper_logs = new Schema({
  owner: { type: String, required: true },
  public: { type: String },
  contract: { type: String },
  trigger: { type: String },
  mintFunction: { type: String },
  tokenPrice: { type: Number },
  tokenAmount: { type: Number },
  gasPrice: { type: Number }, //gwei
  tx: { type: String },
  error: { type: String, default: '' },
  created: { type: Date, default: Date.now },
  status: {
    type: Number,
    default: 0 // 0-pending, 1-success, 2-failed
  }
});

nft_snipper_logs.set('toJSON', { getters: true });
nft_snipper_logs.options.toJSON.transform = (doc, ret) => {
  const obj = { ...ret };
  delete obj.__v;
  return obj;
};
module.exports = mongoose.model('nft_snipper_logs', nft_snipper_logs);
