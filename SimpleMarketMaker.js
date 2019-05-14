const WebSocketClient = require('websocket').client;
const Cybex = require('romejs');

var wsClient = new WebSocketClient();

const cybex = new Cybex();
const assetPair = "ETH/USDT";

let allOrders = [];
const spread = 0.0015;

function handleMarketDataTick(price) {
    const bidPx = price * (1 - spread);
    const askPx = price * (1 + spread);

    allOrders.forEach(order => {
        cybex.cancelOrder(order).then(res => {
            console.log('Order Canceled   : ' + order);
        });
    })
    place(assetPair, "buy", bidPx.toFixed(3), 0.01);
    //console.log("buy", bidPx.toFixed(2));
    place(assetPair, "sell", askPx.toFixed(3), 0.01);
    //console.log("sell", askPx.toFixed(2));
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

function convert_pair(pair){

    let result = "";
    pair.split("/").forEach(asset=>{
        let prefix = asset==="CYB"?"":"JADE_";
        result = result + prefix + asset;
    });

    return result;
}

// WebSocket client to connect to Binance API for OrderBook
wsClient.on('connect', function (connection) {
    console.log("connected");
    let last_price = 1;
    const cmd  = JSON.stringify({"type": "subscribe", "topic": "LASTPRICE."+convert_pair(assetPair)});

    connection.send(cmd);

    connection.on('message', function (message) {

        if (message.type === 'utf8') {
            const data = JSON.parse(message.utf8Data);

            if (data.px !== last_price) {
                last_price = data.px;
                handleMarketDataTick(last_price);
            }else{
                console.log("same price at" + data.px);
            }
        }
    });

    connection.on('close', function () {
        console.log('Connect closed from Cybex...');
    });
});

(async () => {


    const config = {accountName: "accountName", password: "password"};

    const r = await cybex.setSigner(config);

    wsClient.connect('wss://mdp.cybex.io');



})();

