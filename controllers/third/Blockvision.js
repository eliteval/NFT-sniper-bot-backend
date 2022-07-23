const axios = require('axios');
/*
  if contract address is null, then show top nfts among all collections

  Return;
  {
    contractAddress: '0xa27083006D32dD86180DDd1E218D67F1e371801a',
    tokenID: '205',
    amount: '1.99',
    originAmount: '1.99',
    currency: 'ETH',
    from: '0x14Dec35854C5550AFB8FD8394C3cf6593a974666',
    to: '0x66DC2CCcd7fa6206617A8bDeE3fB6dc21b848A3a',
    txHash: '0x07069af247667bd92e476c95509e3db873c35d81bfe67159b6d433053818ff14',
    platform: 'Seaport',
    timestamp: 1657720040
  },
*/

exports.topNFTs = async (contractAddress, pagesize, pagenum) => {
  try {
    var data = JSON.stringify({
      jsonrpc: '2.0',
      id: 0,
      method: 'nft_topNfts',
      params: {
        contractAddress: contractAddress,
        pageSize: Math.min(pagesize, 50), //max 50
        pageIndex: pagenum
      }
    });

    var config = {
      method: 'post',
      url: `https://eth-mainnet.blockvision.org/v1/${process.env.BLOCKVISION_APIKEY}`,
      headers: {
        'Content-Type': 'application/json'
      },
      data: data
    };
    var response = await axios(config);
    return response.data.result.data;
  } catch (error) {
    console.log(error.message);
    return [];
  }
};

/*
  {
    accountAddress: '0x10268D6d6E1b3c5bDd8bE620a9110B3d04F30a1D',
    mostHolding: '',
    holdingValue: '0.107001',
    collectionCount: 0,
    nftCount: 13
  },
*/

exports.topAccounts = async (contractAddress, pagesize, pagenum) => {
  try {
    var data = JSON.stringify({
      jsonrpc: '2.0',
      id: 0,
      method: 'nft_topAccounts',
      params: {
        contractAddress: contractAddress,
        pageSize: Math.min(pagesize, 50), //max 50
        pageIndex: pagenum
      }
    });

    var config = {
      method: 'post',
      url: `https://eth-mainnet.blockvision.org/v1/${process.env.BLOCKVISION_APIKEY}`,
      headers: {
        'Content-Type': 'application/json'
      },
      data: data
    };
    var response = await axios(config);
    return response.data.result.data;
  } catch (error) {
    console.log(error.message);
    return [];
  }
};

/*
 {
    contractAddress: '0x34d85c9CDeB23FA97cb08333b511ac86E1C4E258',
    marketCap: '1485.11',
    holders: 0,
    currency: 'ETH'
  },
*/
exports.topCollections = async (pagesize, pagenum) => {
  try {
    var data = JSON.stringify({
      jsonrpc: '2.0',
      id: 0,
      method: 'nft_topCollections',
      params: {
        pageSize: Math.min(pagesize, 50), //max 50
        pageIndex: pagenum
      }
    });

    var config = {
      method: 'post',
      url: `https://eth-mainnet.blockvision.org/v1/${process.env.BLOCKVISION_APIKEY}`,
      headers: {
        'Content-Type': 'application/json'
      },
      data: data
    };
    var response = await axios(config);
    return response.data.result.data;
  } catch (error) {
    console.log(error.message);
    return [];
  }
};
