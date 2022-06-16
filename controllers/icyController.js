const TrendingCollections = require('../models/icy_trending_collections');
const TradeTransactions = require('../models/icy_trade_transactions');
const Tokens = require('../models/icy_tokens');
const Traits = require('../models/icy_traits');
const axios = require('axios');
const { GraphQLClient, gql } = require('graphql-request');
const graphQLClient = new GraphQLClient('https://graphql.icy.tools/graphql', {
  headers: {
    'x-api-key': '0ccc5ba7edd9443dbfe77eb2ffffacda'
  }
});

/* import moralis */
const Moralis = require('moralis/node');

/* Moralis init code */
const serverUrl = 'https://ehc8jexzkct0.usemoralis.com:2053/server';
const appId = '8v6Eym9LSfNhLO1kWg7HtsgporbJ3BeTQrAQdU42';
const moralisSecret = 'Kmli4JLRwzUp6P3aVMuBAbI4iR9iApVvVSVyG39aMo16eTQnTbaYWFu2cmZVjWKm';

(async () => {})();
var totaltrades = 0;
var totaltokens = 0;

let cronFetchTrendings = async () => {
  await Moralis.start({ serverUrl, appId, moralisSecret });
  var starttime = new Date();
  console.log('DB updating trending collections', starttime);
  totaltrades = 0;
  totaltokens = 0;
  await fetchTrendingCollections(1);
  // await fetchTrendingCollections(4);
  // await fetchTrendingCollections(1 * 24);
  // await fetchTrendingCollections(7 * 24);

  await TradeTransactions.deleteMany({ isSync: true });
  await TradeTransactions.updateMany({ isSync: false }, { isSync: true }, { upsert: true });
  await Tokens.deleteMany({ isSync: true });
  await Tokens.updateMany({ isSync: false }, { isSync: true }, { upsert: true });
  await Traits.deleteMany({ isSync: true });
  await Traits.updateMany({ isSync: false }, { isSync: true }, { upsert: true });

  console.log('total trades: ', totaltrades);
  console.log('total tokens: ', totaltokens);
  console.log('DB updated trending collections', starttime, new Date());
};

/**
 * @param {string} timeframe - hours
 */
let fetchTrendingCollections = async (timeframe) => {
  const query = gql`
    query TrendingCollections($first: Int, $gtTime: Date) {
      contracts(orderBy: SALES, orderDirection: DESC, first: $first) {
        edges {
          node {
            address
            ... on ERC721Contract {
              name
              symbol
              unsafeOpenseaSlug
              unsafeOpenseaImageUrl
              stats(timeRange: { gt: $gtTime }) {
                average
                ceiling
                floor
                volume
                totalSales
              }
            }
          }
        }
      }
    }
  `;
  const variables = {
    first: 10, //max 50
    gtTime: new Date(new Date().getTime() - timeframe * 60 * 60 * 1000)
  };
  try {
    var results = await graphQLClient.request(query, variables);
    results = results.contracts.edges;
    if (results && results.length) {
      await TrendingCollections.deleteMany({ timeframe: timeframe });
      console.log('trending collections records deleted', timeframe);
      await results.reduce(async (accum, item) => {
        // don't progress further until the last iteration has finished:
        await accum;
        console.log(item.node.address, new Date());
        await TrendingCollections.create({
          timeframe: timeframe,
          address: item.node.address,
          name: item.node.name,
          symbol: item.node.symbol,
          unsafeOpenseaImageUrl: item.node.unsafeOpenseaImageUrl,
          unsafeOpenseaSlug: item.node.unsafeOpenseaSlug,
          totalSales: item.node.stats.totalSales,
          average: item.node.stats.average.toFixed(5),
          ceiling: item.node.stats.ceiling.toFixed(5),
          floor: item.node.stats.floor.toFixed(5),
          volume: item.node.stats.volume.toFixed(5)
        });
        await fetchTraits(item.node.address, item.node.unsafeOpenseaSlug);
        await fetchTokens(item.node.address);
        await fetchTrades(item.node.address);
        return 1;
      }, Promise.resolve(''));
    } else {
      console.log('icy fetch data error');
    }
  } catch (error) {
    console.log(error);
  }
};

let fetchTraits = async (address, slug) => {
  if (!slug) return;
  try {
    var result = await axios.get(`https://api.opensea.io/api/v1/collection/${slug}`);
    var traits = result.data.collection.traits;
    for (const type in traits) {
      var typearr = traits[type];
      var totalamount = 0;
      for (const value in typearr) {
        var amount = typearr[value];
        totalamount += amount;
      }
      for (const value in typearr) {
        var amount = typearr[value];
        var rarity = amount / totalamount;
        await Traits.create({
          address,
          type,
          value,
          amount,
          rarity,
          isSync: false
        });
      }
    }
  } catch (error) {
    console.error(error.message);
  }
};

let fetchTrades = async (address) => {
  var data = [];

  var options = {
    address: address,
    cursor: '',
    from_date: new Date(new Date().getTime() - 7 * 24 * 60 * 60 * 1000),
    to_date: new Date(),
    // limit: 500,
    chain: 'eth'
  };
  var result = await Moralis.Web3API.token.getNFTTrades(options);
  data = data.concat(result.result);
  totaltrades += result.total;
  var ttt = result.total;
  while (result.next) {
    result = await Moralis.Web3API.token.getNFTTrades({ ...options, cursor: result.cursor });
    data = data.concat(result.result);
  }
  data.map(async (item, key) => {
    await TradeTransactions.create({
      address: address,
      tokenID: item.token_ids[0],
      seller: item.seller_address,
      buyer: item.buyer_address,
      price: item.price / 1e18,
      transaction: item.transaction_hash,
      marketplace: item.marketplace_address,
      tradeAt: item.block_timestamp,
      isSync: false
    });
  });
  console.log(address, data.length, 'trades fetched among ', ttt);
};

let fetchTokens = async (address) => {
  var data = [];

  var options = {
    address: address,
    cursor: '',
    // limit: 100,
    from_date: new Date(new Date().getTime() - 7 * 24 * 60 * 60 * 1000),
    chain: 'eth'
  };
  var result = await Moralis.Web3API.token.getAllTokenIds(options);
  data = data.concat(result.result);
  totaltokens += result.total;
  var ttt = result.total;

  while (result.next && result.cursor) {
    result = await Moralis.Web3API.token.getAllTokenIds({ ...options, cursor: result.cursor });
    data = data.concat(result.result);
  }

  data.map(async (item, key) => {
    var rarity_score = 1;
    // Calculate rarity score, rarity rank for each token
    if (item.metadata) {
      var metadata = JSON.parse(item.metadata);
      var attributes = metadata.attributes;
      if (attributes) {
        await attributes.reduce(async (accum, attr) => {
          // don't progress further until the last iteration has finished:
          await accum;
          var type = attr.trait_type;
          var value = attr.value;
          //find trait record
          var record = await Traits.findOne({
            address: item.token_address,
            type: type,
            value: value.toLowerCase()
          });
          //calculate score
          var trait_rarity_socre = record ? record.rarity : 0.001;
          rarity_score *= trait_rarity_socre;
          return 1;
        }, Promise.resolve(''));
      }
    }
    // save db
    await Tokens.create({
      token_address: item.token_address,
      name: item.name,
      symbol: item.symbol,
      token_id: item.token_id,
      token_uri: item.token_uri,
      metadata: item.metadata,
      contract_type: item.contract_type,
      synced_at: item.synced_at,
      rarity_score: rarity_score,
      isSync: false
    });
  });
  //give rarity rank
  var records = await Tokens.find({ token_address: address, isSync: false }).sort({
    rarity_score: 1
  });
  records.map(async (record, key) => {
    if (record.rarity_score != 1)
      await Tokens.findOneAndUpdate({ _id: record._id }, { rarity_rank: key + 1 });
  });
  console.log(address, data.length, 'tokens fetched among ', ttt);
};

exports.getTrendingCollections = async (req, res) => {
  try {
    var timeframe = req.body.timeframe ? req.body.timeframe : 1;
    let item = JSON.parse(JSON.stringify(await TrendingCollections.find({ timeframe: timeframe })));
    return res.json({
      data: item
    });
  } catch (err) {
    return res.status(401).json({
      message: 'Read trending collections failed'
    });
  }
};

exports.getTrades = async (req, res) => {
  try {
    var address = req.body.address;
    let item = JSON.parse(JSON.stringify(await TradeTransactions.find({ address: address })));
    return res.json({
      data: item
    });
  } catch (err) {
    return res.status(401).json({
      message: 'Read failed'
    });
  }
};

exports.getTokens = async (req, res) => {
  try {
    var address = req.body.address;
    let item = JSON.parse(
      JSON.stringify(await Tokens.find({ token_address: address }).sort({ token_id: 1 }))
    );
    return res.json({
      data: item
    });
  } catch (err) {
    return res.status(401).json({
      message: 'Read failed'
    });
  }
};

exports.getTraits = async (req, res) => {
  try {
    var address = req.body.address;
    let item = JSON.parse(JSON.stringify(await Traits.find({ address: address })));
    return res.json({
      data: item
    });
  } catch (err) {
    return res.status(401).json({
      message: 'Read failed'
    });
  }
};

exports.getContractInfo = async (req, res) => {
  var lt = new Date();
  var get = new Date(lt.getTime() - 24 * 60 * 60 * 1000);

  const query = gql`
    query($address: String!, $gteTime: Date!, $first: Int!) {
      contract(address: $address) {
        ... on ERC721Contract {
          name
          symbol
          unsafeOpenseaImageUrl
          unsafeOpenseaSlug
          address
          isVerified
          tokenStandard
          stats(timeRange: { gte: $gteTime }) {
            average
            ceiling
            floor
            totalSales
            volume
          }
          tokens(first: $first) {
            pageInfo {
              hasNextPage
              hasPreviousPage
              startCursor
              endCursor
            }
            edges {
              node {
                ... on ERC721Token {
                  tokenId
                  name
                  ownerAddress
                  images {
                    url
                  }
                }
              }
              cursor
            }
          }
        }
      }
    }
  `;
  const variables = {
    address: req.body.address,
    gteTime: get,
    first: 16
  };

  try {
    var results = await graphQLClient.request(query, variables);
    results = results.contract;
    if (results) {
      var data = {
        name: results.name,
        symbol: results.symbol,
        unsafeOpenseaImageUrl: results.unsafeOpenseaImageUrl,
        unsafeOpenseaSlug: results.unsafeOpenseaSlug,
        address: results.address,
        isVerified: results.isVerified,
        tokenStandard: results.tokenStandard,
        average: results.stats.average?.toFixed(5),
        ceiling: results.stats.ceiling?.toFixed(5),
        floor: results.stats.floor?.toFixed(5),
        totalSales: results.stats.totalSales,
        volume: results.stats.volume?.toFixed(5),
        tokens: results.tokens
      };
      return res.json({
        data: data
      });
    } else {
      return res.json({
        data: results,
        messge: 'There is no such contract!'
      });
    }
  } catch (error) {
    console.log(error);
    return res.status(401).json({ message: 'fetch data failed' });
  }
};

exports.searchContracts = async (req, res) => {
  const query = gql`
    query SearchCollections($query: String!) {
      contracts(filter: { name: { icontains: $query } }) {
        edges {
          node {
            address
            ... on ERC721Contract {
              name
              symbol
              unsafeOpenseaImageUrl
            }
          }
        }
      }
    }
  `;
  const variables = {
    query: req.body.query
  };

  try {
    var results = await graphQLClient.request(query, variables);
    results = results.contracts.edges;
    if (results) {
      return res.json({
        data: results
      });
    } else {
      return res.json({
        data: results,
        messge: 'There is no such contract!'
      });
    }
  } catch (error) {
    console.log(error);
    return res.status(401).json({ message: 'fetch data failed' });
  }
};

(async () => {
  await cronFetchTrendings();

  setInterval(async () => {
    await cronFetchTrendings();
  }, 60 * 60 * 1000);
})();

let fetchOrderTransactionsfromICY = async (address, gteTime) => {
  const query = gql`
    query CollectionStats($address: String!, $after: String, $gteTime: Date!) {
      contract(address: $address) {
        ... on ERC721Contract {
          logs(
            after: $after
            first: 100
            filter: { estimatedConfirmedAt: { gte: $gteTime }, type: { eq: ORDER } }
          ) {
            pageInfo {
              hasNextPage
              startCursor
              endCursor
            }
            edges {
              node {
                transactionHash
                type
                fromAddress
                toAddress
                estimatedConfirmedAt
                ... on OrderLog {
                  priceInEth
                }
              }
              cursor
            }
          }
        }
      }
    }
  `;
  var after = '';

  var hasNextPage = true;
  try {
    while (hasNextPage) {
      var variables = {
        address: address,
        after: after,
        gteTime: gteTime
      };
      var results = await graphQLClient.request(query, variables);
      if (results) {
        hasNextPage = results.contract.logs.pageInfo.hasNextPage;
        after = results.contract.logs.pageInfo.endCursor;
        console.log(
          address,
          hasNextPage,
          after,
          results.contract.logs.edges[0].node.estimatedConfirmedAt,
          results.contract.logs.edges.length
        );
      } else {
        console.log('icy fetch data error');
      }
    }
    console.log('fetch done');
  } catch (error) {
    console.log(error.message);
  }
};

let fetchTokensfromICY = async (address) => {
  const query = gql`
    query($address: String!, $after: String) {
      contract(address: $address) {
        ... on ERC721Contract {
          name
          tokens(after: $after, first: 100) {
            pageInfo {
              hasNextPage
              hasPreviousPage
              startCursor
              endCursor
            }
            edges {
              node {
                ... on ERC721Token {
                  tokenId
                  # attributes {
                  #   name
                  #   value
                  # }
                  # metadata {
                  #   image
                  #   attributes {
                  #     trait_type
                  #     value
                  #   }
                  # }
                  # ownerAddress
                  # images {
                  #   url
                  # }
                }
              }
              cursor
            }
          }
        }
      }
    }
  `;
  var variables = {
    address: '0xcd041f40d497038e2da65988b7d7e2c0d9244619',
    after: ''
  };

  var result = await graphQLClient.request(query, variables);

  while (result.contract.tokens.pageInfo.hasNextPage) {
    result = await graphQLClient.request(query, {
      ...variables,
      after: result.contract.tokens.pageInfo.endCursor
    });
  }
};
