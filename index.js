const https = require('https');
const { v4: uuidv4 } = require('uuid');
const onFinished = require('on-finished')
const onHeaders = require('on-headers');
const { ifError } = require('assert');

/*
This code has been adapted from Morgan Logging Package
https://github.com/expressjs/morgan/blob/master/index.js
*/

module.exports = function (options) {
  return function (req, res, next) {
    // Implement the middleware function based on the options object
    //console.log("Got API Request");
    //console.log("options: " + JSON.stringify(options))
    //console.log("Request Path: " + req.path)
    var skip = options.skip || false

    req._startAt = undefined
    req._startTime = undefined
    req._remoteAddress = getIp(req)

    // response data
    res._startAt = undefined
    res._startTime = undefined

    // record request start
    recordStartTime.call(req)

    function logRequest() {

      if (skip !== false && skip(req, res)) {
        return
      }

      var data = {
        dataId: uuidv4(),
        targetDatasetId: options.datasetId,
        eventType: "API",
        timestamp: new Date().toISOString(),
        host: req.hostname,
        path: req.path,
        method: req.method,
        ipAddress: req._remoteAddress,
        useragent: req.headers['user-agent'],
        httpversion: req.httpVersionMajor + '.' + req.httpVersionMinor,
        referrer: req.headers.referer || req.headers.referrer,
        status: headersSent(res) ? String(res.statusCode) : undefined,
        responsetime: getResponseTime(req, res),
        totaltime: getTotalTime(req, res)
      }
      if (options.meta) data.meta = options.meta;

      var postData = JSON.stringify(data)
      //console.log(postData)

      const params = {
        hostname: options.host,
        port: 443,
        path: '/develop/putRecord',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      };

      const apiReq = https.request(params, (res) => {
        //console.log('statusCode:', res.statusCode);
        //console.log('headers:', res.headers);

        res.on('data', (d) => {
          process.stdout.write(d);
        });
      });

      apiReq.on('error', (e) => {
        console.error(e);
      });
      apiReq.write(postData);
      apiReq.end();

    }

    // record response start
    onHeaders(res, recordStartTime)

    // log when response finished
    onFinished(res, logRequest)

    next()
  }
}

function recordStartTime() {
  this._startAt = process.hrtime()
  this._startTime = new Date()
}

function getIp(req) {
  return (req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.ip ||
    req._remoteAddress ||
    (req.connection && req.connection.remoteAddress) || null)
}

function headersSent (res) {
  // istanbul ignore next: node.js 0.8 support
  return typeof res.headersSent !== 'boolean'
    ? Boolean(res._header)
    : res.headersSent
}

function getResponseTime(req, res, digits) {
  if (!req._startAt || !res._startAt) {
    // missing request and/or response start time
    return
  }

  // calculate diff
  var ms = (res._startAt[0] - req._startAt[0]) * 1e3 +
    (res._startAt[1] - req._startAt[1]) * 1e-6

  // return truncated value
  return ms.toFixed(digits === undefined ? 3 : digits)
}

function getTotalTime (req, res, digits) {
  if (!req._startAt || !res._startAt) {
    // missing request and/or response start time
    return
  }

  // time elapsed from request start
  var elapsed = process.hrtime(req._startAt)

  // cover to milliseconds
  var ms = (elapsed[0] * 1e3) + (elapsed[1] * 1e-6)

  // return truncated value
  return ms.toFixed(digits === undefined ? 3 : digits)
}