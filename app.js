#!/usr/bin/env nodejs

var express = require('express');
var fs = require('fs');
var logger = require('morgan');
var path = require('path');
var app = express();
const url = require('url');
var Client = require('node-rest-client').Client;
// google captcha 
var reCAPTCHA=require('recaptcha2');
var request = require('request');
recaptcha=new reCAPTCHA({
  siteKey:'6LcQdTMUAAAAAH_EdGOdn-FJTM_UPm2tSdDdD8kB',
  secretKey:'6LcQdTMUAAAAACw5CNit2xMXDQuvU8bunVAi0BuP'
})
// etherescan related 
var api_key = "9EVWVAFQNS1UWXAAMTXSTHY599GYPAD4T1";
var api = require('etherscan-api').init(api_key);
var txIDLength = 66;
var addressLength = 42;
// ip filtering 
// var ipfilter = require('express-ipfilter').IpFilter;
// // Blacklist the following IPs 
// var ips = [['95.108.128.0','95.108.255.255'],['95.110.0.0','95.110.127.255'],['95.106.0.0','95.107.127.255'],['95.104.128.0','95.105.127.255'],['2.60.0.0','2.63.255.255'],['2.92.0.0','2.95.255.255'],['5.16.0.0','5.19.255.255 ']];
// app.use(ipfilter(ips));
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
  // validate input data
  var validateInput = function(input){
    input = input.toString();
    if(input.substr(0,2).toLowerCase() != "0x" )
      return false;
    if(input.length != addressLength && input.length != txIDLength)
      return false;
    // contains only alphanumeric - ABC and numbers
    return input.match('^(?=.*[a-zA-Z])(?=.*[0-9])[a-zA-Z0-9]+$');
  };
  // write to file
var saveAnalytic = function(data,path){
    console.log("saving to: " + path);
    fs.appendFile(path, data, function (err) {
  if (err) throw err;
  console.log('Saved!');
});
}

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



var validateCaptcha = function(req,res)
{
  if((Object.keys(req.query).length === 0)){
     handleQuery(req,res);
  }
  else
  {
    if(req.query['g-recaptcha-response'] === undefined || req.query['g-recaptcha-response'] === '' || req.query['g-recaptcha-response'] === null)
    {
      return false;
    }
    const secretKey = "6LcQdTMUAAAAACw5CNit2xMXDQuvU8bunVAi0BuP";
    const verificationURL = "https://www.google.com/recaptcha/api/siteverify?secret=" + secretKey + "&response=" + req.query['g-recaptcha-response'] + "&remoteip=" + req.connection.remoteAddress;
    request(verificationURL,function(error,response,body) {
      body = JSON.parse(body);
      if(body.success !== undefined && !body.success) {
             var client = new Client();
        client.get('http://api.fixer.io/latest?base=USD&symbols=ILS',(data,response)=>{            
              res.render('index',{ title : 'Explorer',data: data, error:"אנא סמנ/י 'I'm not robot"}); 
        });
      }
      handleQuery(req,res);
    });
  }  
}

app.get('/calculators', function (req, res) {
   var block = api.proxy.eth_blockNumber();
   block.then((num)=>{
    var blockNumber = api.proxy.eth_getBlockByNumber(num.result);
    blockNumber.then((info)=>{ 
          var transactions = info.result.transactions.splice(0,10);
          transactions.forEach((tx)=>{
            tx.innerGas = hexToDec(tx.gas);
            tx.innerGasPrice = hexToDec(tx.gasPrice);
            tx.innerValue = toETH(hexToDec(tx.value));
          });
          res.json(info);
          //res.json({b_num:hexToDec(num.result),remote:transactions});
    });
   });
});
// app.get('/calculators', function (req, res) {
//    if((Object.keys(req.query).length === 0)){
//     res.render('calculators',{});
//    }
//    else
//    {
//           if(req.query['g-recaptcha-response'] === undefined || req.query['g-recaptcha-response'] === '' || req.query['g-recaptcha-response'] === null)
//           {
//             return res.json({"responseError" : "Please select captcha first"});
//           }
//           const secretKey = "6LcQdTMUAAAAACw5CNit2xMXDQuvU8bunVAi0BuP";
//           const verificationURL = "https://www.google.com/recaptcha/api/siteverify?secret=" + secretKey + "&response=" + req.query['g-recaptcha-response'] + "&remoteip=" + req.connection.remoteAddress;
//           request(verificationURL,function(error,response,body) {
//             body = JSON.parse(body);
//             if(body.success !== undefined && !body.success) {
//               return res.json({"responseError" : "Failed captcha verification"});
//             }
//             res.json({"responseSuccess" : "Sucess"});
//           });
//    }
// });
app.get('/info_explorer', function (req, res) {
  res.render('info_explorer',{});
});


var handleQuery = function(req,res){
    
var ip_addr = req.headers['x-forwarded-for'] || req.connection.remoteAddress.toString();
if(ip_addr.includes(","))
{
	ip_addr = ip_addr.split(",")[0];
}
  if (ip_addr == '95.108.181.125' || ip_addr=='95.108.213.8' || ip_addr=='95.108.213.10'
    || ip_addr=='5.255.253.14' || ip_addr=='87.250.224.95' || ip_addr=='95.108.213.4'
    || ip_addr=='95.108.213.8' || ip_addr=='37.9.113.117' || ip_addr=='178.154.200.1'
    || ip_addr=='213.180.203.25' || ip_addr=='5.255.253.10' || ip_addr=='178.154.171.28'
    || ip_addr=='37.9.113.167' || ip_addr=='41.8.142.96' || ip_addr=='5.45.207.62' 
    || ip_addr=='37.9.113.117' || ip_addr=='178.154.200.1' || ip_addr =='141.8.183.33'
    || ip_addr =='95.108.213.8' || ip_addr =='213.180.203.20' || ip_addr=='95.108.181.120'
    || ip_addr=='95.108.181.125' || ip_addr=='95.108.181.125' || ip_addr=='66.249.70.8'
    || ip_addr=='141.8.144.101' || ip_addr=='141.8.143.135' || ip_addr=='95.108.213.8' 
    || ip_addr=='77.88.5.72' || ip_addr=='162.158.92.63' || ip_addr=='141.8.144.101'
    || ip_addr=='66.249.70.7' || ip_addr=='93.158.161.65' || ip_addr=='84.201.133.73'
    || ip_addr=='93.158.161.49' || ip_addr=='141.8.144.108' || ip_addr =='84.201.133.54'
    || ip_addr=='141.8.144.80' || ip_addr=='66.249.70.7' || ip_addr=='77.88.47.67'
    || ip_addr=='93.158.161.173' || ip_addr=='141.8.144.47' || ip_addr=='93.158.161.44'
    || ip_addr=='84.201.133.27' || ip_addr=='77.88.5.72' || ip_addr=='5.255.250.149' 
    || ip_addr=='66.249.79.7' || ip_addr =='66.249.79.9' || ip_addr=='66.249.79.8'
    || ip_addr=='141.8.144.29')
  {
     console.log('@@@ kicked out @@@ ' + ip_addr);
            // make them wait a bit for a response (optional)
        setTimeout(function() {
            res.end();
        }, 10000);
  }
  else
  {
    console.log(ip_addr + ' logged in @@@@@@@@@@@@@@@@');
  } 

  //user_query = req.body.blockchainquery;
  if((Object.keys(req.query).length === 0))
  {
     analytics_counter +=1;
    // fs.writeFile("/var/www/ETHBlockchainExplorer/analytics", analytics_counter+'\n', function(err) {
    // if(err) {
    //     return console.log(err);
    // }
    console.log(" + 1 user : counter = " + analytics_counter);
    //}); 
    // price widget
      var client = new Client();
      client.get('http://api.fixer.io/latest?base=USD&symbols=ILS',(data,response)=>{
      // ---- links to main page ----- > 
      var block = api.proxy.eth_blockNumber();
      block.then((num)=>{
      var blockNumber = api.proxy.eth_getBlockByNumber(num.result);
      blockNumber.then((info)=>{ 
        var transactions = info.result.transactions.splice(0,Math.min(20,info.result.transactions.length));
        transactions.forEach((tx)=>{
          tx.innerGas = hexToDec(tx.gas);
          tx.innerGasPrice = hexToDec(tx.gasPrice);
          tx.innerValue = toETH(hexToDec(tx.value));
        });
        res.render('index',
          {title:"Explorer",
          data:data,
          redirectSearchUrl:"http://ethereumisrael.org/explorer?q=",
          blockNumber: hexToDec(num.result),
          numOfTransactions:info.result.transactions.length,
          tx_data:transactions,
          blockDifficulty: hexToDec(info.result.totalDifficulty).noExponents(),
          timeStamp:new Date().toLocaleString()});
          //timeStamp: unixTime(parseInt(hexToDec(info.timestamp)))});
      });
      });
      // ----- end of links ----- >             
            //res.render('index',{ title : 'Explorer',data: data}); 
      });
  }

  else if(!validateInput(req.query.q.toString().toLowerCase()))
  {
          if(req.query.q.toString().length == 64){
            saveAnalytic(req.query.q.toString() +'\n',"/var/www/ETHBlockchainExplorer//query_analytics");  
          }
          //saveAnalytic(ip_addr+'\n',"/var/www/ETHBlockchainExplorer//ip_analytics");
          //saveAnalytic(req.query.q.toString() +'\n',"/var/www/ETHBlockchainExplorer//query_analytics");
          var client = new Client();
      client.get('http://api.fixer.io/latest?base=USD&symbols=ILS',(data,response)=>{            
            res.render('index',{ title : 'Explorer',data: data}); 
      });
  }
else
{
  user_query = req.query.q.toString().toLowerCase();
         //   saveAnalytic(ip_addr+'\n',"/var/www/ETHBlockchainExplorer//ip_analytics");
  //saveAnalytic(req.query.q.toString() +'\n',"/var/www/ETHBlockchainExplorer//query_analytics");
          if(req.query.q.toString().length == 64){
            saveAnalytic(req.query.q.toString() +'\n',"/var/www/ETHBlockchainExplorer//query_analytics");  
          }
  if(user_query.length == addressLength)
  {
    var result_address = user_query;
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
                    var try_balance_ils = 0;
                    try
                    {
                      try_just_ils = data.rates.ILS.toString();
                      try_balance_ils =(data.rates.ILS*usd.result.ethusd*eth_balance).toString();
                    } 
                    catch(err)
                    {

                    }                
                    res.render('account',
                      {title:"Account", 
                      redirectSearchUrl : "http://ethereumisrael.org/explorer?q=",
                      results:listTX.result,
                      balance:eth_balance, 
                      accountNum:result_address,
                      balance_ils:try_balance_ils,
                      balance_usd:(usd.result.ethusd*eth_balance).toString(),
                      balance_btc:(usd.result.ethbtc*eth_balance).toString(),
                      usdPrice:usd.result.ethusd.toString(),
                      btcPrice:usd.result.ethbtc.toString(),
                      ilsPrice:try_just_ils});
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
              res.render('transaction',{title:"TX", 
                redirectSearchUrl : "http://ethereumisrael.org/explorer?q=",
                result:info.result});
            }).catch(function(){res.render('index',{ title : 'ETH',error: "קלט לא תקין/כתובת לא קיימת." }); });           
        }).catch(function(){res.render('index',{ title : 'ETH',error: "קלט לא תקין/כתובת לא קיימת." }); });;
      }).catch(function(){res.render('index',{ title : 'ETH',error: "קלט לא תקין/כתובת לא קיימת." }); });;
    }).catch(function(){res.render('index',{ title : 'ETH',error: "קלט לא תקין/כתובת לא קיימת." }); });;
  }
  else
  {
    res.render('index',{ title : 'ETH',error: "קלט לא תקין" }); 
  }
}
};
app.get('/',handleQuery);
//app.get('/',validateCaptcha);
app.post('/',handleQuery);
app.listen(7000);
