const WebSocketClient = require('websocket').client;
const Cybex = require('romejs');
const ccxt = require('ccxt');

var wsClient = new WebSocketClient();
var wsClientCybex = new WebSocketClient();

var openOrder = 0;

const cybex = new Cybex();
const assetPair = "ETH/USDT";

const binance = new ccxt.binance ({
    "apiKey": "471b47a06c384e81b24072e9a8739064",
    "secret": "694025686e9445589787e8ca212b4cff",
});

async function handleMarketDataTick(json) {
    var bestBid = json.bids[0];
    var bestBidPx = Number(bestBid[0]);

    var bestAsk = json.asks[0];
    var bestAskPx = Number(bestAsk[0]);

    // Skew the price for 50bps to ensure they won't be crossed
    bestBidPx = bestBidPx - (bestBidPx * 50 / 10000);
    bestAskPx = bestAskPx + (bestAskPx * 50 / 10000);

    // Round to 2 decimal places to fulfill the min tick to 0.01
    bestBidPx = Math.round(bestBidPx * 100) / 100;
    bestAskPx = Math.round(bestAskPx * 100) / 100;

    // createNewOrderPayload(true, bestBidPx, 0.01, 'ETH/USDT', handleNewOrderPayload);        // bid order
    // createNewOrderPayload(false, bestAskPx, 0.01, 'ETH/USDT', handleNewOrderPayload);       // ask order
    place(assetPair,"buy", bestBidPx,0.01);
    place(assetPair,"sell", bestAskPx,0.01);

}

function createCancelOrderByTxIdPayload(txId) {
    cybex.cancelOrder(txId).then(res=>{
        openOrder--;
        console.log('Order Canceled   : ' + txId);
    });
}

function place(pair, side, px, qty) {
    // async createOrder(assetPair, side, amount, price) {
    cybex.createOrder(pair, side, qty, px).then(res => {
        if (res && res.Status === "Successful") {
            console.log('Sending new order: ' + side + ' ' + pair + ' ' + qty + '@' + px + ' - txId: ' + res.transactionId);
            allOrders.push(res.transactionId)
        }
    });
}

// function place_and_cancel(pair, side, px, qty){
//     // async createOrder(assetPair, side, amount, price) {
//     cybex.createOrder(pair, side, qty, px).then(res=>{
//         if(res.Status === "Successful"){
//             openOrder++;
//             console.log('Sending new order: ' + side + ' ' + pair + ' ' + qty + '@' + px + ' - txId: ' + res.transactionId);
//             setTimeout(createCancelOrderByTxIdPayload, 2000, res.transactionId);
//         }
//     });
// }

// WebSocket client to connect to Binance API for OrderBook
wsClient.on('connect', function (connection) {

    connection.on('message', function (message) {
        if (message.type === 'utf8') {
            handleMarketDataTick(JSON.parse(message.utf8Data));
        }
    });

    connection.on('close', function () {
        console.log('Connect closed from Binance...');
    });
});

wsClientCybex.on("connect", connection=>{
    if(cybex.signer.has_crendential){
        const account = cybex.signer.user.id;
        const cmd  = JSON.stringify({"type": "subscribe", "topic": "ORDERSTATUS."+ account.replace("1.2.","")});
        connection.send(cmd);
    }

    connection.on('message', message => {

        if (message.type === 'utf8') {
            const data = JSON.parse(message.utf8Data);

            if (data.result.orderStatus === 'FILLED') {
                hedge(data.result.side,data.result.price,data.result.quantity);
            }
        }
    });

    connection.on('close', function () {
        console.log('Connect closed from Cybex...');
    });
})

(async () => {

    const config = {accountName:"accountName",password:"password"};

    const r = await cybex.setSigner(config);

    wsClient.connect('wss://stream.binance.com:9443/ws/ethusdt@depth5');

    wsClientCybex.connect("wss://mdp.cybex.io")

})();

