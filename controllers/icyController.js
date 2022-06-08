// import { GraphQLClient, gql } from 'graphql-request';
const { GraphQLClient, gql } = require('graphql-request');
//DB
const TrendingCollections = require('../models/icy_trending_collections');

const graphQLClient = new GraphQLClient('https://graphql.icy.tools/graphql', {
  headers: {
    'x-api-key': '0ccc5ba7edd9443dbfe77eb2ffffacda'
  }
});

let fetchTrendingCollections = async () => {
  const query = gql`
    query TrendingCollections($first: Int) {
      contracts(orderBy: SALES, orderDirection: DESC, first: $first) {
        edges {
          node {
            address
            ... on ERC721Contract {
              name
              symbol
              unsafeOpenseaImageUrl
              stats {
                average
                ceiling
                floor
                totalSales
                volume
              }
            }
          }
        }
      }
    }
  `;
  const variables = {
    first: 10 //max 50
  };
  try {
    var results = await graphQLClient.request(query, variables);
    results = results.contracts.edges;
    if (results && results.length) {
      await TrendingCollections.deleteMany({});
      results.map(async (item, key) => {
        await TrendingCollections.create({
          address: item.node.address,
          name: item.node.name,
          symbol: item.node.symbol,
          unsafeOpenseaImageUrl: item.node.unsafeOpenseaImageUrl,
          totalSales: item.node.stats.totalSales,
          average: item.node.stats.average.toFixed(5),
          ceiling: item.node.stats.ceiling.toFixed(5),
          floor: item.node.stats.floor.toFixed(5),
          volume: item.node.stats.volume.toFixed(5)
        });
      });
    } else {
      console.log('icy fetch data error');
    }
  } catch (error) {
    console.log(error);
  }
};

let fetchOrderTransactions = async (address, gteTime) => {
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

exports.getTrendingCollections = async (req, res) => {
  try {
    let item = JSON.parse(JSON.stringify(await TrendingCollections.find({})));
    return res.json({
      data: item
    });
  } catch (err) {
    return res.status(401).json({
      message: 'Read trending collections failed'
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

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

(async () => {
  setInterval(async () => {
    await fetchTrendingCollections();
  }, 60 * 1000);
})();
