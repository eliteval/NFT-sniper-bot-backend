const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const Presale = new Schema({
  presaleAddr: { type: String, required: true},
  network: { type: String, required: true },
  max:{type:Number},
  min:{type:Number},
  time:{type:Date},  
  amount:{type:Number},
  private:{type:String,required:true},
  public:{type:String,required:true},
  created: { type: Date, default: Date.now },
  status:{ type:Number,default:0} // 0 - progress, 1-done, 2-deleted
});

Presale.set('toJSON', { getters: true });
Presale.options.toJSON.transform = (doc, ret) => {
  const obj = { ...ret };
  delete obj.__v;
  return obj;
};
module.exports = mongoose.model('presale', Presale);
