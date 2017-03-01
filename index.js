var request = require('request');
var _ = require('underscore');
var AWS = require('aws-sdk');
var async = require('async');
var config = require('./config.js')

//reference to Decision lambda function:
var lambda = new AWS.Lambda(config.DECISION_LAMBDA);

// get reference to S3 client
var s3 = new AWS.S3(config.S3_BUCKET);

exports.handler = (event, context, callback) => {

    async.waterfall([
    function(cb) {
        cb(null, event.data);
    },
    getClientData
    ], function (err, clientData ) {
        //stock tickers as query param string:
        var queryParam = (parseStockTickers(clientData)).join(',');
        var requestPath = '/StocksAPI/stocks/getStocks?';

        //create request uri:
        var uri = 'http://' + process.env.FETCH_HOST + ':' + process.env.FETCH_PORT + requestPath + queryParam;
        console.log("== uri: ", uri);

        var data = {"client" : clientData}
        //GET to the fetch service
        request(
            {   method: 'GET',
                uri: uri,
                timeout: 1500
            }
          , function (error, response, body) {
              //got data from Fetch, set data to new data:
               if (!error && response.statusCode == 200) {
                    console.log(body)
                    data.market_price = body;
                }
                else {
                    //TODO: Error getting data from FetchSvc, use old data ?
                    console.log("Fail getting data from FetchSvc: ", error);
                }
                //TODO: uncomment this guy: invokeDecisionEngine(JSON.stringify(data), context);
            });
    });
    callback(null, event);
};

//call Decision lambda function to for decision engine
var invokeDecisionEngine = function(data, context){
    var params = {
    FunctionName: process.env.DECISION_ARN, // the lambda function we are going to invoke
    InvocationType: 'RequestResponse',
    LogType: 'Tail',
    Payload: data
  };
  lambda.invoke(params, function(err, data) {
    if (err) {
      context.fail("Error from Decide lambda: ", err);
    } else {
      context.succeed('Invocation success:  ' + JSON.stringify(data.Payload));
    }
  })
}


//call to S3 to get all files in s3 bucket,
// get json object in each file, push into an array of "client".
function getClientData(eventData, cb) {
    if (eventData) {
        cb(null, eventData);
    }
    else {
        var clientIDs = [], clientData = [];
        async.waterfall([
        function(callback) {

        //Get list of object in this bucket:
        var listObjectParams = { Bucket: process.env.S3_BUCKET_NAME };
        s3.listObjectsV2(listObjectParams, function(err, data) {
            if (err)
                console.log("Error getting listObject: ", err, err.stack);
            else {
                _.each(data.Contents, function(content){
                    clientIDs.push(content['Key']);})
          } //else
          callback(null, clientIDs);
        }); //s3.listObject

    },
    function(clientIDs, callback) {
        //get client object for each client in clientIDs list:
        _.each(clientIDs, function(id){
            var getObjectParams = {
              Bucket: process.env.S3_BUCKET_NAME,
              Key: id.toString(),
            };
            s3.getObject(getObjectParams, function(err, data) {
              if (err) console.log(err, err.stack);
              else {
                   var objectData = data.Body.toString().replace("'",'');
                   clientData.push(JSON.parse(objectData) )
              }
          }); //s3.getObject
        }); //each ClientIds
        ////////////////////////////////////////////
        setTimeout(function(){
            callback(null, clientData);
        }, 500);


    }], function (err, result) {
        if (err) console.log("Error getClientData(): %s", err)
        cb(null, result);
    });

  }//else
}


/*
    Extract out the stock tickers from all clients
    and put them in an array
*/
function parseStockTickers (userData) {
    var tickers = [];
    _.each(userData, function(data){
        _.each(data.stocks, function(stock){
            //if this ticker is not already present in tickers array, add it
            if (!_.contains(tickers, stock.name)) {
                tickers.push(stock.name);
            }
        });
    });

    return tickers;
}


//http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/Lambda.html#invoke-property
