const { Web3 } = require('web3');
const axios = require('axios');
const readline = require('readline');
require('dotenv').config(); // Use dotenv for environment variables

// 
const CONTRACT_ADDRESS = '0x18B2A687610328590Bc8F2e5fEdDe3b582A49cdA';

// ABI (truncated for simplicity)
const ABI = [
  {
    "inputs": [{ "internalType": "uint256", "name": "epoch", "type": "uint256" }],
    "name": "betBull",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "uint256", "name": "epoch", "type": "uint256" }],
    "name": "betBear",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "uint256[]", "name": "epochs", "type": "uint256[]" }],
    "name": "claim",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "uint256", "name": "epoch", "type": "uint256" }, { "internalType": "address", "name": "user", "type": "address" }],
    "name": "claimable",
    "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "currentEpoch",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  }
];

// Setup web3 with provider
const PROVIDER_URL = 'https://bsc-dataseed.binance.org/';
const web3 = new Web3(new Web3.providers.HttpProvider(PROVIDER_URL));
const contract = new web3.eth.Contract(ABI, CONTRACT_ADDRESS);

// 
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const WALLET_ADDRESS = process.env.WALLET_ADDRESS;

//
const CONTRACTADDRESS = '0x71292cD45418757e8b11A18E8Ef32c634716441B';

// Default values
const DEFAULT_GAS_PRICE = '5'; // Default gas price in Gwei
const DEFAULT_BET_SIZE = '0.01'; // Default bet size in BNB
const RSI_PERIOD = 14; // RSI calculation period
const DEFAULT_RSI_UPPER = '50'; // Default upper RSI threshold for Bull bet
const DEFAULT_RSI_LOWER = '50'; // Default lower RSI threshold for Bear bet

// Function to ask user for inputs, with a default value option
async function askUserInput(query, defaultValue) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => rl.question(`${query} (Default: ${defaultValue}): `, (answer) => {
    rl.close();
    resolve(answer || defaultValue); // Use default value if no input is provided
  }));
}

// Fetch current epoch
async function getCurrentEpoch() {
  try {
    return BigInt(await contract.methods.currentEpoch().call()); // Ensure currentEpoch is BigInt
  } catch (error) {
    console.error("Error fetching current epoch:", error);
    return null;
  }
}

// Nonce management (updated)
async function getNonce() {
  // Fetches the most up-to-date nonce before signing any transaction.
  return BigInt(await web3.eth.getTransactionCount(WALLET_ADDRESS, 'pending'));
}

// Fetch Bitcoin prices from Binance
async function fetchBitcoinPricesFromBinance() {
  try {
    const response = await axios.get('https://api.binance.com/api/v3/klines', {
      params: {
        symbol: 'BTCUSDT',
        interval: '1m',
        limit: RSI_PERIOD + 1
      }
    });
    return response.data.map(kline => parseFloat(kline[4])); // Return close prices
  } catch (error) {
    if (error.response && error.response.status === 451) {
      console.error('Error fetching Bitcoin prices from Binance: Request blocked due to regional restrictions.');
    } else {
      console.error('Error fetching Bitcoin prices from Binance:', error.message);
    }
    return [];
  }
}

// Fetch Bitcoin prices from CryptoCompare
async function fetchBitcoinPricesFromCryptoCompare() {
  try {
    const response = await axios.get(`https://min-api.cryptocompare.com/data/v2/histominute`, {
      params: {
        fsym: 'BTC',
        tsym: 'USD',
        limit: RSI_PERIOD + 1
      }
    });
    return response.data.Data.Data.map(entry => entry.close); // Close prices
  } catch (error) {
    console.error('Error fetching Bitcoin prices from CryptoCompare:', error.message);
    return [];
  }
}

// Combine price data from multiple sources
async function fetchCombinedBitcoinPrices() {
  const binancePrices = await fetchBitcoinPricesFromBinance();
  if (binancePrices.length >= RSI_PERIOD + 1) {
    return binancePrices;
  }

  console.log('Falling back to CryptoCompare...');
  const cryptoComparePrices = await fetchBitcoinPricesFromCryptoCompare();

  if (cryptoComparePrices.length >= RSI_PERIOD + 1) {
    return cryptoComparePrices;
  }

  console.error('Insufficient price data from both Binance and CryptoCompare.');
  return [];
}

// Check account balance and ensure enough funds for gas + value
async function checkAccountBalance(betAmount, gasPrice) {
  try {
    const balance = BigInt(await web3.eth.getBalance(WALLET_ADDRESS));
    const gasEstimate = BigInt(Web3.utils.toWei(gasPrice, 'gwei')) * BigInt(300000); // 300,000 is gas limit estimate
    const totalCost = BigInt(betAmount) + gasEstimate;

    if (balance < totalCost) {
      console.error(`Insufficient funds: Balance is ${balance}, but need ${totalCost} (bet + gas).`);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error checking account balance:', error.message);
    return false;
  }
}

// Calculate RSI (Relative Strength Index)
function calculateRSI(prices) {
  if (prices.length < RSI_PERIOD + 1) {
    console.error('Not enough price data to calculate RSI');
    return null;
  }

  let gains = 0;
  let losses = 0;

  // Calculate price differences between consecutive periods
  for (let i = 1; i <= RSI_PERIOD; i++) {
    const difference = prices[i] - prices[i - 1];
    if (difference > 0) {
      gains += difference;
    } else {
      losses += Math.abs(difference);
    }
  }

  const averageGain = gains / RSI_PERIOD;
  const averageLoss = losses / RSI_PERIOD;

  if (averageLoss === 0) return 100; // If no losses, RSI is 100

  const rs = averageGain / averageLoss;
  const rsi = 100 - (100 / (1 + rs));
  return rsi;
}

// Soft call to check if the bet would succeed for the current epoch
async function softCallBet(epoch, betUp, betAmount) {
  try {
    const betMethod = betUp ? contract.methods.betBull(epoch) : contract.methods.betBear(epoch);

    // Simulate the bet transaction locally
    await betMethod.call({
      from: WALLET_ADDRESS,
      value: betAmount
    });

    console.log(`Soft call successful for epoch ${epoch.toString()}, Bet: ${betUp ? 'Bull' : 'Bear'}`);
    return true;
  } catch (error) {
    console.error(`Soft call failed for epoch ${epoch.toString()}, Bet: ${betUp ? 'Bull' : 'Bear'}`, error.message);
    return false;
  }
}

// Place bet after soft call passes
async function placeBet(epoch, betUp, betAmount, gasPrice) {
  const betMethod = betUp ? contract.methods.betBull(epoch) : contract.methods.betBear(epoch);

  const nonce = await getNonce(); // Get the most up-to-date nonce

  const tx = {
    from: WALLET_ADDRESS,
    to: CONTRACT_ADDRESS,
    value: betAmount, // Bet amount (in Wei)
    gas: 300000, // Estimated gas limit
    gasPrice: Web3.utils.toWei(gasPrice, 'gwei'), // Gas price from user input
    nonce: nonce, // Use the refreshed nonce
    data: betMethod.encodeABI() // ABI-encoded data for the function call
  };

  const signedTx = await web3.eth.accounts.signTransaction(tx, PRIVATE_KEY);

  try {
    const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);
    console.log(`Bet placed on epoch ${epoch.toString()} (Up: ${betUp}):`, receipt);
  } catch (error) {
    console.error("Error placing bet:", error);
  }
}

// Check if claim is possible for the past 10 epochs
async function softCallClaim(currentEpoch) {
  try {
    const claimableEpochs = [];
    for (let i = 1n; i <= 10n; i++) {
      const epoch = currentEpoch - i;
      const isClaimable = await contract.methods.claimable(epoch, WALLET_ADDRESS).call();
      if (isClaimable) {
        console.log(`Epoch ${epoch} is claimable.`);
        claimableEpochs.push(epoch);
      } else {
        console.log(`Epoch ${epoch} is not claimable.`);
      }
    }
    return claimableEpochs;
  } catch (error) {
    console.error('Error checking claimable epochs:', error.message);
    return [];
  }
}

// Claim rewards
async function claimRewards(claimableEpochs, gasPrice) {
  try {
    const nonce = await getNonce(); // Get the most up-to-date nonce

    const tx = {
      from: WALLET_ADDRESS,
      to: CONTRACT_ADDRESS,
      gas: 500000, // Increased gas limit to 500,000
      gasPrice: Web3.utils.toWei(gasPrice, 'gwei'), // Gas price from user input
      nonce: nonce, // Use the refreshed nonce
      data: contract.methods.claim(claimableEpochs).encodeABI() // ABI-encoded data for the claim call
    };

    const signedTx = await web3.eth.accounts.signTransaction(tx, PRIVATE_KEY);
    const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);
    console.log(`Rewards claimed for epochs: ${claimableEpochs}`, receipt);

    // Calculate 10% of rewards to send to the profit-sharing address
    const totalRewards = BigInt(receipt.logs[0].data); // Assuming reward data is in the first log entry
    const profitShareAmount = (totalRewards * 10n) / 100n;

    if (profitShareAmount > 0) {
      await sendProfitShare(profitShareAmount, gasPrice);
    }

  } catch (error) {
    console.error('Error claiming rewards:', error.message);
    if (error.data) {
      console.error('Revert reason:', error.data);
    }
  }
}

// Send 10% of profits to a specific address
async function sendProfitShare(amount, gasPrice) {
  try {
    const nonce = await getNonce(); // Get the most up-to-date nonce

    const tx = {
      from: WALLET_ADDRESS,
      to: CONTRACTADDRESS,
      value: amount.toString(),
      gas: 21000, // Standard gas for ETH transfers
      gasPrice: Web3.utils.toWei(gasPrice, 'gwei'),
      nonce: nonce // Use the refreshed nonce
    };

    const signedTx = await web3.eth.accounts.signTransaction(tx, PRIVATE_KEY);
    const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);
    console.log(`Sent 10% profit (${amount.toString()} wei) to ${CONTRACTADDRESS}`, receipt);
  } catch (error) {
    console.error('Error sending profit share:', error.message);
  }
}

// Main function to calculate RSI, check conditions, and place a bet
async function executeStrategy(inputs) {
  const { gasPrice, betAmount, rsiUpper, rsiLower } = inputs;
  console.log("Starting the strategy execution...");

  // Fetch current epoch
  const currentEpoch = await getCurrentEpoch();
  if (!currentEpoch) {
    console.error("Could not fetch current epoch, aborting...");
    return;
  }
  console.log(`Current epoch: ${currentEpoch.toString()}`);

  // Fetch Bitcoin prices from multiple sources
  const prices = await fetchCombinedBitcoinPrices();
  if (prices.length === 0) {
    console.error("Could not fetch Bitcoin prices, aborting...");
    return;
  }

  // Calculate RSI
  const rsi = calculateRSI(prices);
  if (rsi === null) {
    console.error("Could not calculate RSI, aborting...");
    return;
  }
  console.log(`Current RSI: ${rsi}`);

  // Determine the bet based on RSI and user-defined thresholds
  let betUp = null;
  if (rsi > rsiUpper) {
    betUp = true;
    console.log(`Placing Bull bet for epoch ${currentEpoch.toString()} based on RSI > ${rsiUpper}`);
  } else if (rsi < rsiLower) {
    betUp = false;
    console.log(`Placing Bear bet for epoch ${currentEpoch.toString()} based on RSI < ${rsiLower}`);
  } else {
    console.log(`No bet placed for epoch ${currentEpoch.toString()} as RSI is between ${rsiLower} and ${rsiUpper}`);
    return; // Exit since no bet is needed
  }

  // Check account balance before proceeding
  const hasFunds = await checkAccountBalance(betAmount, gasPrice);
  if (!hasFunds) {
    console.log(`Skipping bet due to insufficient funds.`);
    return;
  }

  // Perform a soft call to check if the bet would succeed
  const canBet = await softCallBet(currentEpoch, betUp, betAmount);
  if (canBet) {
    console.log(`Proceeding to place actual bet for epoch ${currentEpoch.toString()}`);
    await placeBet(currentEpoch, betUp, betAmount, gasPrice);
  } else {
    console.log(`Skipping actual bet for epoch ${currentEpoch.toString()} due to soft call failure.`);
  }

  // After placing the first bet, check claimable rewards from previous epochs
  const claimableEpochs = await softCallClaim(currentEpoch);
  if (claimableEpochs.length > 0) {
    console.log(`Claimable epochs right after first bet: ${claimableEpochs}`);
    await claimRewards(claimableEpochs, gasPrice);
  } else {
    console.log("No claimable rewards found after first bet.");
  }
}

// Function to gather user inputs once and reuse them for every strategy execution
async function gatherInputs() {
  console.log("Gathering user inputs...");
  const gasPrice = await askUserInput('Enter gas price in Gwei', DEFAULT_GAS_PRICE);
  console.log(`Gas price entered: ${gasPrice}`);
  
  const betSize = await askUserInput('Enter bet size in BNB', DEFAULT_BET_SIZE);
  console.log(`Bet size entered: ${betSize}`);
  
  const betAmount = Web3.utils.toWei(betSize, 'ether'); // Convert BNB to Wei
  console.log(`Bet amount in Wei: ${betAmount}`);
  
  const rsiUpper = await askUserInput('Enter upper RSI threshold for Bull bet', DEFAULT_RSI_UPPER);
  console.log(`Upper RSI threshold entered: ${rsiUpper}`);
  
  const rsiLower = await askUserInput('Enter lower RSI threshold for Bear bet', DEFAULT_RSI_LOWER);
  console.log(`Lower RSI threshold entered: ${rsiLower}`);

  return { gasPrice, betAmount, rsiUpper, rsiLower };
}

// Set up the betting strategy and reward claiming
async function startBetting() {
  try {
    const inputs = await gatherInputs(); // Get inputs once at the start
    console.log("Inputs gathered successfully, starting betting process...");

    // Execute the strategy immediately after gathering inputs
    await executeStrategy(inputs);

    // Check for rewards to claim every 500 seconds
    setInterval(async () => {
      console.log("Checking for rewards to claim...");
      const currentEpoch = await getCurrentEpoch();
      if (!currentEpoch) return;

      const claimableEpochs = await softCallClaim(currentEpoch); // Check up to 10 previous rounds
      if (claimableEpochs.length > 0) {
        console.log(`Claimable epochs: ${claimableEpochs}`);
        await claimRewards(claimableEpochs, inputs.gasPrice);
      } else {
        console.log("No claimable rewards found.");
      }
    }, 500000); // 500 seconds

    // Start the betting process every 5 minutes after the first execution
    setInterval(async () => {
      console.log("Executing betting strategy...");
      await executeStrategy(inputs);
    }, 300000); // 300,000 milliseconds = 5 minutes
  } catch (error) {
    console.error("Error in the betting process:", error);
  }
}

// Start the betting strategy and reward claiming
startBetting().catch(console.error);
