const Authorization = require('../models/authorization');
const core_func = require('../utils/core_func');

exports.add = async (req, res) => {
  try {
    let data = req.body;
    //check body data
    if (!data.address) {
      return res.status(403).json({
        message: 'Please input contract address correctly.'
      });
    }
    if (data.amount <= 0) {
      return res.status(403).json({
        message: 'Please input amount correctly.'
      });
    }

    //check address already exist
    const exist = await Authorization.findOne({ address: data.address });
    if (exist) return res.status(401).json({ message: 'Contract already exist.' });

    //save to db
    const itemSaved = await new Authorization(data).save();

    const item = await Authorization.find({});
    return res.json({
      message: 'success',
      data: item
    });
  } catch (err) {
    console.log('[ERROR]', err);
    return res.status(401).json({
      message: 'error'
    });
  }
};
exports.read = async (req, res) => {
  try {
    const item = await Authorization.find({});
    return res.json({
      data: item
    });
  } catch (err) {
    console.log('[ERROR]', err);
    return res.status(401).json({
      message: 'error'
    });
  }
};
exports.delete = async (req, res) => {
  try {
    const { _id } = req.body;
    await Authorization.findOneAndDelete({ _id: _id });
    const item = await Authorization.find({});
    return res.json({
      message: 'Successfully deleted!',
      data: item
    });
  } catch (err) {
    console.log('[ERROR]', err);
    return res.status(401).json({
      message: 'error'
    });
  }
};
