const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const Swing = new Schema({
  addr: { type: String, required: true},
  max:{type:Number},
  min:{type:Number},
  interval:{type:Number},
  private:{type:String,required:true},
  public:{type:String,required:true},
  count:{type:Number,required:true,default:0},
  slippage:{type:Number,defalut:10},
  status:{type:Number,default:0},//0-buy,1-sell
  created: { type: Date, default: Date.now },
});

Swing.set('toJSON', { getters: true });
Swing.options.toJSON.transform = (doc, ret) => {
  const obj = { ...ret };
  delete obj.__v;
  return obj;
};
module.exports = mongoose.model('swing', Swing);
