const WebSocketClient = require('websocket').client;
const Cybex = require('romejs');

var wsClient = new WebSocketClient();

const cybex = new Cybex();
const assetPair = "ETH/USDT";

let allOrders = [];


function handleMarketDataTick(bidPx, askPx) {

    allOrders.forEach(order => {
        cybex.cancelOrder(order).then(res => {
            console.log('Order Canceled   : ' + order);
        });
    })

    cybex.createOrder(assetPair, "buy", 0.01, bidPx).then(res => {
        if (res && res.Status === "Successful") {
            console.log('Sending new order: ' + "buy"  + ' ' + 0.01 + '@' + bidPx + ' - txId: ' + res.transactionId);
            allOrders.push(res.transactionId)
        }
    });

    cybex.createOrder(assetPair, "sell", 0.01, askPx).then(res => {
        if (res && res.Status === "Successful") {
            console.log('Sending new order: ' + sell + ' ' + 0.01 + '@' + askPx + ' - txId: ' + res.transactionId);
            allOrders.push(res.transactionId)
        }
    });
}


function convert_pair(pair) {

    let result = "";
    pair.split("/").forEach(asset => {
        let prefix = asset === "CYB" ? "" : "JADE_";
        result = result + prefix + asset;
    });

    return result;
}

// WebSocket client to connect to Binance API for OrderBook
wsClient.on('connect', function (connection) {
    console.log("connected");
    const spread = 0.0005;
    let last_price = 1;

    const cmd = JSON.stringify({"type": "subscribe", "topic": "LASTPRICE." + convert_pair(assetPair)});
    connection.send(cmd);

    connection.on('message', function (message) {

        if (message.type === 'utf8') {
            const data = JSON.parse(message.utf8Data);

            if (data.px !== last_price) {
                last_price = parseFloat(data.px);
                const bidPx = last_price * (1 - spread);
                const askPx = last_price * (1 + spread);

                handleMarketDataTick(bidPx, askPx);
            } else {
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

