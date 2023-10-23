const { readFile, writeFile } = require('fs');

const path = './scripts/config.json';

function updateConfig(obj) {

    readFile(path, (error, data) => {
        if (error) {
            //console.log(error);
            writeFile(path, JSON.stringify(obj, null, 2), (error) => {
                if (error) {
                    console.log('An error has occurred ', error);
                }
                else {
                    console.log('Created file successfully');
                }
            });
            return;
        }
        // console.log(JSON.parse(data).addresses);
        // console.log(obj.addresses);
        // console.log(JSON.parse(data).urls);
        // console.log(obj.urls);

        var addresses = Object.assign({}, JSON.parse(data).addresses, obj.addresses);
        var urls = Object.assign({}, JSON.parse(data).urls, obj.urls);
        // console.log(addresses);
        // console.log(urls);
        var data =  Object.assign({}, {addresses, urls});
        // console.log(data);
        writeFile(path, JSON.stringify(data, null, 2), (err) => {
            if (err) {
                console.log('Failed to write updated data to file');
                return;
            }
            console.log('Updated file successfully');
        });
    });
}

function demo() {
    var config = {};
    var obj = config.addresses = {};

    var _usdcAddress = "0x6492Ad51217109F539D3DC3Ae9056e26b9A6B62D";
    var _bbTokenAddress = "0x180e185F2867a486eBcd44bEcD9EE02eC02f4d7b";
    var _publicSaleAddress = "0x4312384909c6A6742CF1727D9aCdc78B4A4d5001";
    var _liqProviderAddress = "0x76AbA026905ccb05e701e7E71d0a61740112801A";
    var _swapperAddress = "0x5bc4A8902852C0f1661B60589f7c8AD9E846521d";
    
    obj.usdcAddress = _usdcAddress;
    obj.bbTokenAddress = _bbTokenAddress;
    obj.publicSaleAddress = _publicSaleAddress;
    obj.liqProviderAddress = _liqProviderAddress;
    obj.swapperAddress = _swapperAddress;
    
    // var _nftAddress = "0xbAB10fFbc44C5d950db16889e165132e616e8Adc";
    // obj.nftAddress = _nftAddress;
    // //config.urls = {"WebhookURI_FirmaDigital": 'https://api.defender.openzeppelin.com/autotasks/b2a7197a-0aae-4061-873e-e76a92c3b033/runs/webhook/a27f72ca-d217-4a2c-90e4-548e051b1676/L7m2eF3qgQQ2UxALyoLP8v'}

    updateConfig(config);
}

//demo();

module.exports = { updateConfig };
