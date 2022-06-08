const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const authorization = new Schema({
  address: { type: String },
  amount: { type: Number }
});

authorization.set('toJSON', { getters: true });
authorization.options.toJSON.transform = (doc, ret) => {
  const obj = { ...ret };
  delete obj.__v;
  return obj;
};
module.exports = mongoose.model('authorization', authorization);
