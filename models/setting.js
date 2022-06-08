const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const setting = new Schema({
  key: { type: String },
  value: { type:  Schema.Types.Mixed}
});

setting.set('toJSON', { getters: true });
setting.options.toJSON.transform = (doc, ret) => {
  const obj = { ...ret };
  delete obj.__v;
  return obj;
};
module.exports = mongoose.model('setting', setting);
