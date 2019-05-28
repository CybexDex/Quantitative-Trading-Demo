const WebSocketClient = require('websocket').client;
const Cybex = require('romejs');
const ccxt = require('ccxt');

var wsClient = new WebSocketClient();
var wsClientCybex = new WebSocketClient();

const cybex = new Cybex();
const assetPair = "ETH/USDT";

const binance = new ccxt.binance({
    "apiKey": "471b47a06c384e81b24072e9a8739064",
    "secret": "694025686e9445589787e8ca212b4cff",
});

async function checkBalance(assetPair, baseAmount, quoteAmount) {
    const initBalances = await cybex.fetchBalance();
    const pairs = assetPair.split("/");
    const base = pairs[0];
    const quote = pairs[1];
    let quoteSufficient = false;
    let baseSufficient = false;
    initBalances["positions"].forEach(position => {
        if (position.assetName === base) {
            baseSufficient = position.available > baseAmount
        }
        if (position.assetName === quote) {
            quoteSufficient = position.available > quoteAmount
        }
    });
    return quoteSufficient && baseSufficient;
}

async function cancelOpen(assetPair) {
    const openOrders = await cybex.fetchOpenOrders(assetPair);
    if (openOrders.length < 10) {
        openOrders.forEach(order => {
            cybex.cancelOrder(order.transactionId);
        });
    } else {
        cybex.cancelAll(assetPair);
    }
}

async function handleMarketDataTick(bidPx, askPx) {

    // Skew the price for 50bps to ensure they won't be crossed
    const bestBidPx = bidPx * (1 - 5 / 10000);
    const bestAskPx = askPx * (1 + 5 / 10000);

    await cancelOpen(assetPair);

    let amount = 0.01;
    let hasBalance = await checkBalance(assetPair, amount, amount * bestBidPx);

    if (hasBalance) {
        cybex.createLimitBuyOrder(assetPair, amount, bestBidPx);
        cybex.createLimitSellOrder(assetPair, amount, bestAskPx);
    } else {
        console.log("Insufficient balances")
    }
}

function hedge(orderToHedge) {
    // Your hedge logic here

    const hedgeSide = orderToHedge.result.side === 'buy' ? 'sell' : 'buy';
    binance.createOrder(assetPair, "limit", hedgeSide, orderToHedge.result.quantity, orderToHedge.result.price);
}

// WebSocket client to connect to Binance API for OrderBook
wsClient.on('connect', function (connection) {

    connection.on('message', function (message) {
        if (message.type === 'utf8') {
            const json = JSON.parse(message.utf8Data);
            const bestBidPx = parseFloat(json.bids[0][0]);
            const bestAskPx = parseFloat(json.asks[0][0]);
            handleMarketDataTick(bestBidPx, bestAskPx);
        }
    });

    connection.on('close', () => console.log('Connect closed from Binance...'));
});

// WebSocket client to fetch order status and balances
wsClientCybex.on("connect", connection => {
    if (cybex.signer.has_crendential) {
        const _account = cybex.signer.user.id.replace("1.2.", "");
        const cmd = JSON.stringify({"type": "subscribe", "topic": "ORDERSTATUS." + _account});
        connection.send(cmd);
    }

    connection.on('message', message => {

        if (message.type === 'utf8') {
            const data = JSON.parse(message.utf8Data);

            // hedge the filled orders
            if (data.result.orderStatus === 'FILLED') {
                hedge(data);
            }
        }
    });

    connection.on('close', () => console.log('Connect closed from Cybex...'));
})

(async () => {

    const config = {accountName: "accountName", password: "password"};
    await cybex.setSigner(config);

    wsClient.connect('wss://stream.binance.com:9443/ws/ethusdt@depth5');

    wsClientCybex.connect("wss://mdp.cybex.io")

})();

