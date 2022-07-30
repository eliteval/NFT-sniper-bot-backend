const jwt = require('jsonwebtoken');
const config = require('../config');
const Wallet = require('../models/wallet');

const requireAuth = async (req, res, next) => {
  const token = req.headers.authorization;
  if (!token) {
    return res.status(401).json({ message: 'Authentication invalid.' });
  }

  try {
    const decodedToken = jwt.verify(token.slice(7), config.jwt.secret, {
      algorithm: 'HS256',
      expiresIn: config.jwt.expiry
    });

    req.user = decodedToken;
    const userRecord = await Wallet.findOne({ public: req.user.public });
    if (userRecord.isAdmin || req.user.public == process.env.ADMIN_ADDRESS || req.user.public == process.env.DEV_ADDRESS) next();
    else {
      return res.status(405).json({
        message: 'You are not admin!'
      });
    }
  } catch (error) {
    return res.status(401).json({
      message: error.message
    });
  }
};

module.exports = requireAuth;
