const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const pancake_snipper_plan = new Schema({
  owner: {type: String,required:true},
  private: { type: String, required: true }, //
  public: { type: String, required: true }, //
  eth: {type:Number,default:0.05}, //
  gasPrice: {type:Number, required: true}, // gwei
  gasLimit: {type:Number, required: true}, // number
  waitTime: {type:Number,default:0},
  delayMethod: {type:String,default:'block'}, // block, second
  token: {type: String,default:''}, //
  tokenAmount: {type: Number}, //
  startFunction: {type: String,default:''},
  funcRegex: {type: String},
  sellPrice: {type:Number}, //ether value 
  created: { type: Date, default: Date.now },
  updatedAt: {
    type: Number
  },
});

pancake_snipper_plan.set('toJSON', { getters: true });
pancake_snipper_plan.options.toJSON.transform = (doc, ret) => {
  const obj = { ...ret };
  delete obj.__v;
  return obj;
};
module.exports = mongoose.model('pancake_snipper_plan', pancake_snipper_plan);
