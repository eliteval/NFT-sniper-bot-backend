const TrendingCollections = require('../models/icy_trending_collections');
const TopCollections = require('../models/icy_top100_collections');
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

//Number of collections, Updating Duration (hours)
var top_collections_num, updating_hours;
if (process.env.MODE == 'DEV') top_collections_num = 1;
else top_collections_num = 100;

if (process.env.MODE == 'DEV') updating_hours = 1;
else updating_hours = 8;

(async () => {
  await Moralis.start({ serverUrl, appId, moralisSecret });
  //top 100
  await cronFetchTop100();
  setInterval(async () => {
    await cronFetchTop100();
  }, 6 * 60 * 60 * 1000);

  //trending collections
  await cronFetchTrendings();
  setInterval(async () => {
    await cronFetchTrendings();
  }, updating_hours * 60 * 60 * 1000);
})();

var totaltrades = 0;
var totaltokens = 0;

let cronFetchTrendings = async () => {
  var starttime = new Date();
  console.log('Trending Collections Updating', starttime);
  totaltrades = 0;
  totaltokens = 0;

  await TrendingCollections.updateMany({}, { isLoading: false }, { upsert: true });
  await Traits.updateMany({}, { isLoading: false }, { upsert: true });
  await Tokens.updateMany({}, { isLoading: false }, { upsert: true });
  await Trades.updateMany({}, { isLoading: false }, { upsert: true });

  await _fetchTrendingCollections(1);
  await _fetchTrendingCollections(4);
  await _fetchTrendingCollections(1 * 24);
  await _fetchTrendingCollections(7 * 24);

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
  console.log('Trending Collections Updated', starttime, new Date());
};

let _fetchTrendingCollections = async (timeframe) => {
  console.log(`fetching top #${top_collections_num} collections for timeframe `, timeframe);
  const query = gql`
    query TrendingCollections($first: Int, $gtTime: Date, $after: String) {
      contracts(orderBy: SALES, orderDirection: DESC, first: $first, after: $after) {
        pageInfo {
          endCursor
        }
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
    after: '',
    first: top_collections_num, //max 50
    gtTime: new Date(new Date().getTime() - timeframe * 60 * 60 * 1000)
  };

  var results = await graphQLClient.request(query, variables);
  var endCursor = results.contracts.pageInfo.endCursor;
  results = results.contracts.edges;

  if (top_collections_num > 50) {
    var temp = await graphQLClient.request(query, {
      ...variables,
      after: endCursor
    });
    results = results.concat(temp.contracts.edges);
  }

  if (results && results.length) {
    await results.reduce(async (accum, item, key) => {
      // don't progress further until the last iteration has finished:
      await accum;
      console.log(`\n### ${timeframe} - ${key + 1} ###`, item.node.address, new Date());
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
        await _fetchTraits(item.node.address, item.node.unsafeOpenseaSlug);
        await _fetchTokens(item.node.address);
        await _fetchTrades(item.node.address);
      }
      return 1;
    }, Promise.resolve(''));
  } else {
    console.log('icy fetch data error');
  }
};

let _fetchTraits = async (address, slug) => {
  if (!slug) return;
  console.log(`${slug}, start fetch traits`);
  var total = 0;
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
        var rarity = totalamount == 0 ? 1 : amount / totalamount;
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
  } catch (error) {
    console.log(error.message);
  }

  console.log(`${slug}, traits saved,${total} values`);
};

let _fetchTokens = async (address) => {
  try {
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
    process.stdout.write(`getNFTs ${ttt} tokens, ${progress} `);

    while (result.next && result.cursor) {
      result = await Moralis.Web3API.token.getNFTOwners({
        ...options,
        cursor: result.cursor
      });
      data = data.concat(result.result);
      progress += result.result.length; //progress bar
      bar1.update(progress); //progress bar
      process.stdout.write(progress + ' ');
      if (progress > 100000) break;
    }
    bar1.stop(); //progress bar
    console.log('getNFTs done', new Date());
    // Calculate rarity score, rarity rank for each token
    var traitsCount = await Traits.find({
      address: address,
      isLoading: true
    }).countDocuments();
    var records = await Traits.find({
      address: address,
      isLoading: true
    });
    await data.reduce(async (accum, item, key) => {
      await accum;
      if (key % 100 == 0) process.stdout.write(key + ' ');
      var rarity_score = 1;
      var name;
      var image;
      var attributes;

      if (item.metadata && traitsCount > 0) {
        var metadata = JSON.parse(item.metadata);
        name = metadata.name;
        image = metadata.image;
        if (image) image = image.replace('ipfs://', 'https://ipfs.io/ipfs/');
        attributes = metadata.attributes;
        if (attributes) {
          await attributes.reduce(async (accum, attr) => {
            // don't progress further until the last iteration has finished:
            await accum;

            var type = attr.trait_type;
            var value = attr.value;
            //find trait record
            var record = records.find(
              (element) => element.type == type && element.value == value?.toString().toLowerCase()
            );
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
    console.log('rarity score', new Date());

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
  } catch (error) {
    console.log(error.message);
  }
};

let _fetchTrades = async (address) => {
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
  console.log(result.total);
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

let cronFetchTop100 = async () => {
  try {
    var result = await axios.get(`https://api.cryptoslam.io/v1/collections/top-100?timeRange=all`);
    await TopCollections.deleteMany({});
    result.data.map(async (item) => {
      await TopCollections.create(item);
    });
    console.log('Top Collections Updated', new Date());
  } catch (err) {
    console.log(err.message);
  }
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

    //rarity_rank query
    var token_id_query = {};
    if (filter.token_id.min) token_id_query.$gte = filter.token_id.min;
    if (filter.token_id.max) token_id_query.$lte = filter.token_id.max;
    if (filter.token_id.min || filter.token_id.max) findquery.token_id = token_id_query;

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
    let holdersdata = JSON.parse(
      JSON.stringify(
        await Tokens.aggregate([
          { $match: { token_address: address, isSync: true } },
          { $group: { _id: '$owner', count: { $sum: 1 } } }
        ]).sort({
          count: -1
        })
      )
    );
    let top_holdersdata = JSON.parse(
      JSON.stringify(
        await Tokens.aggregate([
          { $match: { token_address: address, isSync: true } },
          { $group: { _id: '$owner', count: { $sum: 1 } } }
        ])
          .sort({
            count: -1
          })
          .limit(100)
      )
    );
    var tokens_count = await Tokens.find({
      token_address: address,
      isSync: true
    }).countDocuments();
    var holders = holdersdata.length;
    var avg_owned = holdersdata.length == 0 ? 1 : tokens_count / holdersdata.length;
    var unique_percent = (holdersdata.length / tokens_count) * 100;
    var holders1 = 0,
      holders2_5 = 0,
      holders6_20 = 0,
      holders21_50 = 0,
      holders51 = 0;
    holdersdata.map((item) => {
      if (item.count == 1) holders1++;
      if (item.count >= 2 && item.count <= 5) holders2_5++;
      if (item.count >= 6 && item.count <= 20) holders6_20++;
      if (item.count >= 21 && item.count <= 50) holders21_50++;
      if (item.count >= 51) holders51++;
    });

    return res.json({
      data: top_holdersdata,
      tokens_count: tokens_count,
      holders: holders,
      avg_owned: avg_owned,
      unique_percent: unique_percent,
      holders1: holders1,
      holders2_5: holders2_5,
      holders6_20: holders6_20,
      holders21_50: holders21_50,
      holders51: holders51
    });
  } catch (err) {
    console.log(err.message);
    return res.status(401).json({
      message: 'Read failed'
    });
  }
};

exports.getNerdBooks = async (req, res) => {
  try {
    var address = req.body.address;
    var result = await axios.get(`https://storage.googleapis.com/nftnerds-books/${address}`);
    return res.json(result.data);
  } catch (err) {
    console.log(err.message);
    return res.status(401).json({
      message: 'getNerdTrades failed'
    });
  }
};

exports.getNerdTrades = async (req, res) => {
  try {
    var address = req.body.address;
    var result = await axios.get(`https://storage.googleapis.com/nftnerds-trades/${address}`);
    return res.json(result.data);
  } catch (err) {
    console.log(err.message);
    return res.status(401).json({
      message: 'getNerdTrades failed'
    });
  }
};

exports.getTop100Collections = async (req, res) => {
  try {
    var records = await TopCollections.find({}).sort({ rank: 1 });
    return res.json({
      data: records
    });
  } catch (err) {
    console.log(err.message);
    return res.status(401).json({
      message: 'getTop100Collections failed'
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

let zfetchOrderTransactionsfromICY = async (address, gteTime) => {
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

let zfetchTokensfromICY = async (address) => {
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
