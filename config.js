module.exports = {
  port: process.env.PORT || 7777,
  db: {
    prod: process.env.DATABASE_URL || 'mongodb://localhost/bot',
    test: 'mongodb://localhost/bot',
    options: {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      useFindAndModify: false,
      useCreateIndex: true
    }
  },
  jwt: {
    //for players credential
    secret: process.env.JWT_SECRET || 'development_secret',
    expiry: '1d'
  },
  credentials:{
    //for provider credential
    expiry: 10
  }
};
