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
    console.log("=============== event ? ", event);
    if (isInvalidData(event)) {
        callback("Invalid payload or invalid data format")
    }

    async.waterfall([
    function(cb) {
        cb(null, event.data);
    },
    getClientData
    ], function (err, clientData ) {
        if (err) {
            console.log("Error from getClientData(): ", err);
        }
        //stock tickers as query param string:
        var queryParam = (parseStockTickers(clientData)).join(',');
        var requestPath = '/stocks/getStocks?tickers=';

        //create request uri:
        var uri = 'http://' + process.env.FETCH_HOST + requestPath + queryParam;
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
                    console.log("Successful response (Fetch): ", body)
                    data.market_price = JSON.parse(body);
                }
                else {
                    //TODO: Error getting data from FetchSvc, use old data ?
                    console.log("Fail getting data from FetchSvc: ", error);
                }
                console.log("Send to Decision: ", JSON.stringify(data))
                invokeDecisionEngine(JSON.stringify(data), context);
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
    console.log("== getClientData(): ", eventData);
    if (eventData) {
        console.log("Trigger from lambda 1: ", eventData);
        cb(null, eventData);
    }
    else {
        console.log("==== Self-triggering ==== ");
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
                   console.log("getObject from S3: ", objectData)
              }
          }); //s3.getObject
        }); //each ClientIds
        ////////////////////////////////////////////
        setTimeout(function(){
            callback(null, clientData);
        }, 500);
        ////////////////////////////////////////////

    }], function (err, result) {
        if (err) console.log("Error getClientData(): %s", err)
        cb(err, result);
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

//clientData = event, make sure it's JSON
function isInvalidData(clientData){
    var invalidData = false;
    //there's event, but no 'data' field: invalid
    if (clientData && !clientData.data) {
            invalidData = true;
    }
    else {//there's event.data, but not JSON:
        try {
            JSON.parse(clientData);
        } catch (e) {
            console.log("Unable to parse to JSON: ", e);
            invalid = true;
        }
    }

    return invalidData;
}
//http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/Lambda.html#invoke-property
