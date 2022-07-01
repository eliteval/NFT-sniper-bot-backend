const Setting = require('../models/setting');
const core_func = require('../utils/core_func');

exports.read = async (req, res) => {
  try {
    const item = await Setting.find({});
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
exports.update = async (req, res) => {
  try {
    const { key, value } = req.body;
    await Setting.updateOne({ key: key }, { key: key, value: value }, { upsert: true });
    const item = await Setting.find({});
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
    await Setting.findOneAndDelete({ _id: _id });
    const item = await Setting.find({});
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
