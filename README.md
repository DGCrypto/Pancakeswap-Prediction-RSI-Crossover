# RSIPancakePredictionBot
PancakeSwap Prediction game by use of RSI Crossover!

![RSI Prediction Bot](https://github.com/DGCrypto/RSIPancakePredictionBot/blob/main/IMG_0183.jpg)
***
![Console Bet Log](https://github.com/DGCrypto/RSIPancakePredictionBot/blob/main/RSIPredBotConsole.png)

![RSI CrossOver Strategy](https://github.com/DGCrypto/RSIPancakePredictionBot/blob/main/E3BFD33A-8C91-464E-ABDE-D0A574A74786.jpeg)

RSI CrossOver Strategy

**# RSI PancakeSwap Prediction Bot**



**Trial Version** Will not claim rewards! 
Full version with reward claiming is for sale via Telegram.
Future versions with different indicators will be for sale soon!
Small % of bet size is charged as usage fee in the free/trial version!

Telegram: https://t.me/+WRurSkMEq0RiOTRh



![Pancake Interface of test!](https://github.com/DGCrypto/RSIPancakePredictionBot/blob/main/RSIPredPancake.png)

![RSI Prediction Bot Test](https://github.com/DGCrypto/RSIPancakePredictionBot/blob/main/predbottest.PNG)

Small Sample Prediction Bot Results from non optimized first testing period!

![Metamask Options to get privkey for local env file](https://github.com/DGCrypto/RSIPancakePredictionBot/blob/main/options.PNG)

![Export PrivateKey](https://github.com/DGCrypto/RSIPancakePredictionBot/blob/main/exportprivkey.PNG)

Place private key in ENV File and Save-as ".env"

[.env file](https://github.com/DGCrypto/RSIPancakePredictionBot/blob/main/.env.example)

Fill out .env file with web3 http provider link, taapi api key(must purchase), account address, privkey, bet size, rsi time values for fast and slow! Simulates an rsi crossover using a lower time-frame for fast and higher time-frame for slow!

![Taapi](https://github.com/DGCrypto/RSIPancakePredictionBot/blob/main/taapi%20(1).PNG)

The second lowest subscription is recommended for taapi!


NPM and node.js is needed to install and run.




Instructions!

1.   Download RSIPredOb.js
2.   "npm i taapi web3 graceful-fs dotenv binance-api-node"
3.   Get non-rate limited or private http provider for Binance Smart Chain.
3.   Fill out env file! Save as .env
4.   Use command "Node RSIPredOb.js"
5.   Remember to claim rewards since this is not included in the trial version!


Experiment with rsi chart time values! 
There could be better fast and slow times because our team has tried only the times listed in env example file!
