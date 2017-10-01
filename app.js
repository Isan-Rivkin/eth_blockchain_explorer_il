#!/usr/bin/env nodejs

var express = require('express');
var fs = require('fs');
var logger = require('morgan');
var path = require('path');
var app = express();
var Client = require('node-rest-client').Client;
// etherescan related 
var api_key = "9EVWVAFQNS1UWXAAMTXSTHY599GYPAD4T1";
var api = require('etherscan-api').init(api_key);
var txIDLength = 66;
var addressLength = 42;
/**
  Functions 
*/
var analytics_counter = 0;
Number.prototype.noExponents= function(){
    var data= String(this).split(/[eE]/);
    if(data.length== 1) return data[0]; 

    var  z= '', sign= this<0? '-':'',
    str= data[0].replace('.', ''),
    mag= Number(data[1])+ 1;

    if(mag<0){
        z= sign + '0.';
        while(mag++) z += '0';
        return z + str.replace(/^\-/,'');
    }
    mag -= str.length;  
    while(mag--) z += '0';
    return str + z;
}
var toETH = function(weiBalance){
  return weiBalance/1000000000000000000;
}
var gweiToEth = function(gwei){
  return gwei*0.000000001;
}
var hexToDec=function(hexString){
  var cleaned = hexString.toString().substr(2,hexString.toString().length);
  return parseInt(cleaned,16);
}
function unixTime(unixtime) {

    var u = new Date(unixtime*1000);

      return u.getUTCFullYear() +
        '-' + ('0' + u.getUTCMonth()).slice(-2) +
        '-' + ('0' + u.getUTCDate()).slice(-2) + 
        ' ' + ('0' + u.getUTCHours()).slice(-2) +
        ':' + ('0' + u.getUTCMinutes()).slice(-2) +
        ':' + ('0' + u.getUTCSeconds()).slice(-2) +
        '.' + (u.getUTCMilliseconds() / 1000).toFixed(3).slice(2, 5) 
    };
 // for extracting data from post forms urls
var bodyParser = require('body-parser')
app.use(bodyParser.urlencoded({
    extended: true
}));
app.use(bodyParser.json());
/////////////////

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');
app.use(logger('dev')); //replaces your app.use(express.logger());


app.use(express.static(path.join(__dirname, 'views')));
//app.use('/static', express.static(path.join(__dirname, 'public')));

app.get('/', function (req, res) {
  analytics_counter +=1;
  fs.writeFile("/var/www/ETHBlockchainExplorer/analytics", analytics_counter+'\n', function(err) {
    if(err) {
        return console.log(err);
    }
    console.log(" + 1 user : counter = " + analytics_counter);
}); 
    res.render('index',{ title : 'ETH',content: "Welcome ..." }); 
});
app.get('/calculators', function (req, res) {
    res.render('calculators',{ title : 'Calculator',content: "Welcome ..." }); 
});
var handleQuery = function(req,res){
  user_query = req.body.blockchainquery;
  if(user_query.length == addressLength)
  {
    // get list of transactions 
    var returned_obj = {full_list:[]};
    var txlist = api.account.txlist(user_query.toString(), 1, 'latest', 'desc');
    var balance = api.account.balance(user_query.toString());
    var usd_price = api.stats.ethprice();
    var client = new Client();
//{ "status": "1", "message": "OK", "result": { "isError": "0", "errDescription": "" } }
    txlist.then((listTX)=>{
      for (var i=0;i<listTX.result.length;++i)
      {
        listTX.result[i].fee = toETH(listTX.result[i].gasUsed*listTX.result[i].gasPrice);
        listTX.result[i].value = toETH(listTX.result[i].value);
        listTX.result[i].innerTime = unixTime(listTX.result[i].timeStamp);
        listTX.result[i].innerIsError = listTX.result[i].isError == "1" ? "כן" :"לא";
        if(user_query.toString().toLowerCase()==listTX.result[i].from.toString().toLowerCase())
        {
          listTX.result[i].innerFrom = "את/ה";
          listTX.result[i].innerTo = "אדם אחר";
        }
        else if(user_query.toString().toLowerCase()==listTX.result[i].to.toString().toLowerCase())
        {
           listTX.result[i].innerFrom = "אדם אחר";
           listTX.result[i].innerTo = "את/ה"; 
        }
        var client_result = 30;
        if(listTX.result.length > client_result)
        {
          listTX.result = listTX.result.splice(0,client_result);
        }         
      }
      balance.then((wei)=>{
        var eth_balance = toETH(wei['result']);
        usd_price.then((usd)=>{
          client.get('http://api.fixer.io/latest?base=USD&symbols=ILS',(data,response)=>{                   
                    res.render('account',
                    {title:"Account", 
                      results:listTX.result,
                      balance:eth_balance, 
                      accountNum:user_query.toString(),
                      balance_ils:(data.rates.ILS*usd.result.ethusd*eth_balance).toString(),
                      balance_usd:(usd.result.ethusd*eth_balance).toString(),
                      balance_btc:(usd.result.ethbtc*eth_balance).toString(),
                      usdPrice:usd.result.ethusd.toString(),
                      btcPrice:usd.result.ethbtc.toString(),
                      ilsPrice:data.rates.ILS.toString()});
          });
        });
      });
    }).catch(function(){
      res.render('index',{ title : 'ETH',error: "קלט לא תקין/כתובת לא קיימת." }); 
    });
  }
  else if(user_query.length == txIDLength)
  {
    // get transaction reciept
    var tx_reciept = api.proxy.eth_getTransactionReceipt(user_query.toString());
    // get transaction status 
    var tx_status = api.transaction.getstatus(user_query.toString());
    // get transaction info 
    var tx_info = api.proxy.eth_getTransactionByHash(user_query.toString());
    tx_reciept.then((reciept)=>{
      tx_status.then((status)=>{
        tx_info.then((info)=>{
            var hexBlocknum= info.result.blockNumber.toString().substr(2,info.result.blockNumber.toString().length);
            var byBlockAndIndex =api.proxy.eth_getBlockByNumber(hexBlocknum);
            byBlockAndIndex.then((block)=>{
              var hexTime = block.result.timestamp.toString().substr(2,block.result.timestamp.toString().length);
              info.result.innerTimeStamp = unixTime(parseInt(hexTime,16));
              var gasUsed = hexToDec(reciept.result.gasUsed);
              var gasPrice = hexToDec(info.result.gasPrice);
              info.result.gasPrice = gweiToEth(gweiToEth(gasPrice)).noExponents();
              info.result.gasLimit = hexToDec(info.result.gas);
              info.result.gasUsed = gasUsed;
              info.result.innerFee = toETH(gasPrice*gasUsed);
              info.result.innerValue = toETH(hexToDec(info.result.value));
              info.result.innerNonce = hexToDec(info.result.nonce);
              info.result.blockNumber = hexToDec(info.result.blockNumber);
              info.result.txStatus = status.status.toString() =="1" ? "הסתיימה": "לא הסתיימה" ;
              info.result.isError = status.result.isError.toString() == "1"? "כן" : "לא"; 
              res.render('transaction',{title:"TX", result:info.result});
            }).catch(function(){res.render('index',{ title : 'ETH',error: "קלט לא תקין/כתובת לא קיימת." }); });           
        }).catch(function(){res.render('index',{ title : 'ETH',error: "קלט לא תקין/כתובת לא קיימת." }); });;
      }).catch(function(){res.render('index',{ title : 'ETH',error: "קלט לא תקין/כתובת לא קיימת." }); });;
    }).catch(function(){res.render('index',{ title : 'ETH',error: "קלט לא תקין/כתובת לא קיימת." }); });;
  }
  else
  {
    res.render('index',{ title : 'ETH',error: "קלט לא תקין" }); 
  }
};
app.post('/',handleQuery);
app.listen(7000);
