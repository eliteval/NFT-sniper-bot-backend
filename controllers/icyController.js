const TrendingCollections = require('../models/icy_trending_collections');
const Trades = require('../models/icy_trades');
const Tokens = require('../models/icy_tokens');
const Traits = require('../models/icy_traits');
const axios = require('axios');
const ethers = require('ethers');

const cliProgress = require('cli-progress');
const bar1 = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
const { GraphQLClient, gql } = require('graphql-request');
const graphQLClient = new GraphQLClient('https://graphql.icy.tools/graphql', {
  headers: {
    'x-api-key': '0ccc5ba7edd9443dbfe77eb2ffffacda'
  }
});

/* import moralis */
const Moralis = require('moralis/node');

/* Moralis init code */
const serverUrl = 'https://ncjyxkasj8xr.usemoralis.com:2053/server';
const appId = 'WHeAxRRa1EPI4YWEl6eLRDNjHfhTNxiuGTCGZg0F';
const moralisSecret = 'hYn1exAoYfAcsoeNl55ZOHeZCALN18wXxsq1gNIpakcVPbZRU9FBPGS55x44PiSe';

const top_collections_num = 1;

(async () => {
  await Moralis.start({ serverUrl, appId, moralisSecret });

  // await cronFetchTrendings();

  setInterval(async () => {
    await cronFetchTrendings();
  }, 60 * 60 * 1000);
})();

var totaltrades = 0;
var totaltokens = 0;

let cronFetchTrendings = async () => {
  var starttime = new Date();
  console.log('DB updating Analysis', starttime);
  totaltrades = 0;
  totaltokens = 0;

  await TrendingCollections.updateMany({}, { isLoading: false }, { upsert: true });
  await Traits.updateMany({}, { isLoading: false }, { upsert: true });
  await Tokens.updateMany({}, { isLoading: false }, { upsert: true });
  await Trades.updateMany({}, { isLoading: false }, { upsert: true });

  await fetchTrendingCollections(1);
  // await fetchTrendingCollections(4);
  // await fetchTrendingCollections(1 * 24);
  // await fetchTrendingCollections(7 * 24);

  await TrendingCollections.deleteMany({ isLoading: false });
  await TrendingCollections.updateMany(
    { isLoading: true },
    { isLoading: false, isSync: true },
    { upsert: true }
  );
  await Trades.deleteMany({ isLoading: false });
  await Trades.updateMany(
    { isLoading: true },
    { isLoading: false, isSync: true },
    { upsert: true }
  );
  await Tokens.deleteMany({ isLoading: false });
  await Tokens.updateMany(
    { isLoading: true },
    { isLoading: false, isSync: true },
    { upsert: true }
  );
  await Traits.deleteMany({ isLoading: false });
  await Traits.updateMany(
    { isLoading: true },
    { isLoading: false, isSync: true },
    { upsert: true }
  );

  console.log('total trades: ', totaltrades);
  console.log('total tokens: ', totaltokens);
  console.log('DB updated Analysis', starttime, new Date());
};

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
    first: top_collections_num, //max 50
    gtTime: new Date(new Date().getTime() - timeframe * 60 * 60 * 1000)
  };
  console.log(`fetching top #${top_collections_num} collections for timeframe `, timeframe);

  var results = await graphQLClient.request(query, variables);
  results = results.contracts.edges;
  if (results && results.length) {
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
        volume: item.node.stats.volume.toFixed(5),
        isSync: false,
        isLoading: true
      });
      //count current loading same contract
      var count = await TrendingCollections.find({
        address: item.node.address,
        isLoading: true
      }).countDocuments();
      if (count == 1) {
        // await fetchTraits(item.node.address, item.node.unsafeOpenseaSlug);
        // await fetchTokens(item.node.address);
        // await fetchTrades(item.node.address);

        await fetchTraits('0xcc15b249f8ac06b4a56deb5627afcef061df45a4', 'spunmonkes');
        await fetchTokens('0xcc15b249f8ac06b4a56deb5627afcef061df45a4');
        await fetchTrades('0xcc15b249f8ac06b4a56deb5627afcef061df45a4');
      }
      return 1;
    }, Promise.resolve(''));
  } else {
    console.log('icy fetch data error');
  }
};

let fetchTraits = async (address, slug) => {
  if (!slug) return;

  var result = await axios.get(`https://api.opensea.io/api/v1/collection/${slug}`);
  var traits = result.data.collection.traits;

  var total = 0;
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
        isSync: false,
        isLoading: true
      });
      total++;
    }
  }
  console.log(`${slug}, traits saved,${total} values`);
};

let fetchTokens = async (address) => {
  var data = [];

  var options = {
    address: address,
    cursor: '',
    // limit: 100,
    chain: 'eth'
  };
  var result = await Moralis.Web3API.token.getNFTOwners(options);
  data = data.concat(result.result);
  totaltokens += result.total;

  var ttt = result.total; //progress bar
  var progress = result.result.length; //progress bar
  bar1.start(ttt, progress); //progress bar

  // while (result.next && result.cursor) {
  //   result = await Moralis.Web3API.token.getNFTOwners({
  //     ...options,
  //     cursor: result.cursor
  //   });
  //   data = data.concat(result.result);
  //   progress += result.result.length; //progress bar
  //   bar1.update(progress); //progress bar
  // }
  bar1.stop(); //progress bar
  console.log('test 1', data.length, new Date());

  // Calculate rarity score, rarity rank for each token
  var traitsCount = await Traits.find({
    address: address,
    isLoading: true
  }).countDocuments();
  console.log(traitsCount, ' traits');

  await data.reduce(async (accum, item) => {
    await accum;
    var rarity_score = 1;
    var name;
    var image;
    var attributes;

    if (item.metadata && traitsCount > 0) {
      var metadata = JSON.parse(item.metadata);
      name = metadata.name;
      image = metadata.image;
      image = image.replace('ipfs://', 'https://ipfs.io/ipfs/');
      attributes = metadata.attributes;
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
            value: value?.toString().toLowerCase(),
            isLoading: true
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
      token_id: item.token_id,
      name: name,
      image: image,
      attributes: attributes,
      owner: item.owner_of,
      token_uri: item.token_uri,
      metadata: item.metadata,
      contract_type: item.contract_type,
      synced_at: item.synced_at,
      rarity_score: rarity_score,
      isSync: false,
      isLoading: true
    });
    return 1;
  }, Promise.resolve(''));

  console.log('test 2', new Date());

  //give rarity rank
  var records = await Tokens.find({
    token_address: address,
    isLoading: true
  }).sort({
    rarity_score: 1
  });

  await records.reduce(async (accum, record, key) => {
    await accum;

    if (record.rarity_score != 1)
      await Tokens.findOneAndUpdate({ _id: record._id }, { rarity_rank: key + 1 });

    return 1;
  }, Promise.resolve(''));

  console.log(address, data.length, 'tokens fetched among ', ttt, new Date());
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
    result = await Moralis.Web3API.token.getNFTTrades({
      ...options,
      cursor: result.cursor
    });
    data = data.concat(result.result);
  }
  data.map(async (item, key) => {
    await Trades.create({
      address: address,
      tokenID: item.token_ids[0],
      seller: item.seller_address,
      buyer: item.buyer_address,
      price: item.price / 1e18,
      transaction: item.transaction_hash,
      marketplace: item.marketplace_address,
      tradeAt: item.block_timestamp,
      isSync: false,
      isLoading: true
    });
  });
  console.log(address, data.length, 'trades fetched among ', ttt);
};

exports.getTrendingCollections = async (req, res) => {
  try {
    var timeframe = req.body.timeframe ? req.body.timeframe : 1;
    let item = JSON.parse(
      JSON.stringify(await TrendingCollections.find({ timeframe: timeframe, isSync: true }))
    );
    return res.json({
      data: item
    });
  } catch (err) {
    return res.status(401).json({
      message: 'Read trending collections failed'
    });
  }
};

exports.getTraits = async (req, res) => {
  try {
    var address = req.body.address;
    let item = JSON.parse(JSON.stringify(await Traits.find({ address: address, isSync: true })));
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
    var pagination = req.body.pagination;
    var filter = req.body.filter;
    //declare findquery
    var findquery = {
      token_address: address,
      isSync: true
    };
    //attribute query
    var attributeFilterArr = [];
    filter.traits.map((item) => {
      attributeFilterArr.push({
        trait_type: { $regex: `^${item[0]}$`, $options: '-i' },
        value: { $regex: `^${item[1]}$`, $options: '-i' }
      });
    });
    if (attributeFilterArr.length)
      findquery.attributes = {
        $elemMatch: {
          $or: attributeFilterArr
        }
      };
    //rarity_rank query
    var rarity_rank_query = {};
    if (filter.rank.min) rarity_rank_query.$gte = filter.rank.min;
    if (filter.rank.max) rarity_rank_query.$lte = filter.rank.max;
    if (filter.rank.min || filter.rank.max) findquery.rarity_rank = rarity_rank_query;

    // console.log(findquery);

    //find
    var total = await Tokens.find(findquery).countDocuments();
    let item = JSON.parse(
      JSON.stringify(
        await Tokens.find(findquery)
          .sort({
            token_id: 0
          })
          .skip((pagination.pagenumber - 1) * pagination.perpage)
          .limit(pagination.perpage)
      )
    );
    return res.json({
      data: item,
      total: total
    });
  } catch (err) {
    console.log(err.message);
    return res.status(401).json({
      message: 'Read failed'
    });
  }
};

exports.getTrades = async (req, res) => {
  try {
    var address = req.body.address;
    let item = JSON.parse(JSON.stringify(await Trades.find({ address: address, isSync: true })));
    return res.json({
      data: item
    });
  } catch (err) {
    return res.status(401).json({
      message: 'Read failed'
    });
  }
};

exports.getHolders = async (req, res) => {
  try {
    var address = req.body.address;
    let item = JSON.parse(
      JSON.stringify(
        await Tokens.aggregate([
          { $match: { isSync: true } },
          { $group: { _id: '$owner', count: { $sum: 1 } } }
        ]).sort({
          count: -1
        })
      )
    );
    var tokens_count = await Tokens.find({
      token_address: address,
      isSync: true
    }).countDocuments();
    return res.json({
      data: item,
      tokens_count: tokens_count
    });
  } catch (err) {
    console.log(err.message);
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

// (async () => {
//   const provider = new ethers.providers.JsonRpcProvider(
//     'https://red-old-frog.quiknode.pro/2458f7b70db61a6db94d20c9a898cbeb4714f408/'
//   );
//   provider.connection.headers = { 'x-qn-api-version': 1 };
//   var starttime = new Date();
//   for (var i = 0; i < 100; i++) {
//     var heads = await provider.send('qn_fetchNFTsByCollection', {
//       collection: '0x0ee80069c9b4993882fe0b3fc256260eff385982',
//       omitFields: ['collectionName', 'provenance'],
//       page: i + 1,
//       perPage: 100
//     });
//     console.log(heads.pageNumber);
//   }
//   console.log('quicknode', starttime, new Date());
// })();

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
