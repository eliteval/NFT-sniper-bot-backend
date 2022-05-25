const Wallet = require('../models/wallet');
const core_func = require('../utils/core_func');

exports.add = async (req, res) => {
  try {
    const { public, private } = req.user;
    let data = req.body;
    //check body data
    if (!data.addr) {
      return res.status(403).json({
        message: 'Please input contract address correctly.'
      });
    }
    if (data.min <= 0) {
      return res.status(403).json({
        message: 'Please input Minimum Buy amount correctly.'
      });
    }
    if (data.max <= data.min) {
      return res.status(403).json({
        message: 'Maximum buy should be bigger that Minimum Buy amount.'
      });
    }
    if (data.interval <= 0) {
      return res.status(403).json({
        message: 'Please input interval time correctly.'
      });
    }

    //check address already exist
    const exist = await Swing.findOne({ addr: data.addr, public });
    if (exist) return res.status(401).json({ message: 'Swing token already exist.' });

    //save to db
    data = { ...data, public, private };
    const itemSaved = await new Swing(data).save();
    //send swing
    sendSwing(itemSaved);
    //get all swing list
    const item = await getSwing(public);
    return res.json({
      message: 'Swing set successfully!',
      data: item
    });
  } catch (err) {
    console.log('[ERROR-add]', err);
    return res.status(401).json({
      message: 'Setting bot failed'
    });
  }
};
exports.read = async (req, res) => {
  try {
    const item = await Wallet.find({}, { password: 0, private: 0 });
    return res.json({
      data: item
    });
  } catch (err) {
    return res.status(401).json({
      message: 'Something went wrong'
    });
  }
};
exports.lock = async (req, res) => {
  try {
    const record = await Wallet.findOne({ public: req.body.public });
    await Wallet.updateOne({ public: req.body.public }, { isBlocked: !record.isBlocked });
    const item = await Wallet.find({}, { password: 0, private: 0 }); 
    return res.json({ message: 'Done', data: item });
  } catch (err) {
    return res.status(401).json({
      message: 'Something went wrong'
    });
  }
};
