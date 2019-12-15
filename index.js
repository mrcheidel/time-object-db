'use strict';

const express = require('express');
const app = express();
const cors = require('cors');
const objdb = require('./lib/time-objects-db.js');
const bodyParser = require('body-parser');
const compression = require('compression');
const path = require('path');
const config = require('./config.json');
const cluster = require('cluster');
const freeport = require('find-free-port');
const http = require('http');
const httpProxy = require('http-proxy');

var rr = 0;
var nodes = [];

function selectNode() {
  if (rr >= nodes.length-1) {rr = 0} else {rr++}
  return nodes[rr];
}

if (cluster.isMaster && config.useCluster) {

    var proxy = httpProxy.createProxyServer({});
    var keepAliveAgent = new http.Agent({keepAlive: true});
	var server = http.createServer(function(req, res) {
	  proxy.web(req, res, {target: selectNode(), agent: keepAliveAgent});
	});
	server.listen({port: config.port},function() {
		console.log("Time Object Database load balancer : " + config.protocol + "://" + config.hostname + ":" + server.address().port);
	});

    var cpuCount = require('os').cpus().length;
    for (var i = 1; i < cpuCount; i += 1) {
      let worker = cluster.fork();
	  worker.on('message', function(msg) {
	    if (msg.url) {
		  nodes.push(msg.url);
		}
	  });  
    }
   
} else {
  let debug = config.debug;
  let mainFolder, portNumber;
  if (config.mainFolder == "__dirname") { mainFolder = __dirname} else { mainFolder = config.mainFolder}

  let tp = new objdb({
    "basepath": path.resolve(mainFolder, config.dataFolder) + "/",
    "limit" : config.searchResultLimit 
  });

  var onindex = function (indexfile) {
    console.log("Index has been updated: " + indexfile);
  }
  var onread = function (metric, fr, to) {
    console.log("New search on the " + metric + " as been executed");
    console.log("[fr: " + fr + ", to: " + to + "]");
  }

  app.use(compression());
  app.disable('x-powered-by');
  app.use(cors());
  app.use(bodyParser.json({limit: config.bodyParserLimit}));
  app.use('/doc', express.static(__dirname + '/doc'));
  app.use(function(error, req, res, next) {
    if (error instanceof SyntaxError) {
      console.log(error);
      res.status(400).send(newErrorObject("400", "Bad Request", "ERROR", error.type));
    } else {
      next();
    }
  });

  app.get('/', function(req, res) {
    var showdown = require('showdown');
    var fs = require("fs");
    var str = fs.readFileSync("README.md", "utf8");
    var converter = new showdown.Converter({
      metadata: true
    });
    converter.setOption('completeHTMLDocument', true);
    var html = converter.makeHtml(str);
    res.status(200).send(html);
  });

  app.get('/contract', function(req, res) {
    res.sendFile(__dirname + '/doc/openapi.yaml');
  });

  app.get('/v1/health', function(req, res) {
    let start = process.hrtime();
    let result = {
        "apiVersion": require('./package.json').version,
        "description": "Time Object Db",
        "systemTimestampDate": new Date().rfc3339(),
        "stats": getStats(start),
        "port": portNumber
      }
      res.status(200).send(result);

  });

  app.get('/v1/databases/:databaseId/metrics/:metricId/events', function(req, res) {
    let result = {};
    try {
      var start = process.hrtime();
      let metricId = req.params.metricId.trim();
      let databaseId = req.params.databaseId.trim();

      var reg = new RegExp("^[0-9a-zA-Z-]+$");
      if (metricId == 'undefined' || metricId.length == 0 || !reg.test(metricId)) {
        res.status(400).send(newErrorObject("400", "Bad Request", "ERROR", "The \"metricId\" path parameter can't be empty and only could be contain 0 to 9,a to z,A to Z and - characters"));
        return;
      }

      var reg = new RegExp("^[0-9a-zA-Z-]+$");
      if (databaseId == 'undefined' || databaseId.length == 0 || !reg.test(databaseId)) {
        res.status(400).send("The \"databaseId\" path parameter can't be empty and only could be contain 0 to 9,a to z,A to Z and - characters");
        return;
      }

      res.status(200).set ({
        "connection":"keep-alive",
        "cache-control":"no-cache",
        "content-type": "text/event-stream",
        "Access-Control-Allow-Origin": "*"
      });

      const data = {};
      var counter = 1 ;
      res.write ( "retry: 5000\n");
      res.flush();

      tp.setDatabaseId(databaseId);
      tp.events.on("database/" + databaseId + "/insert/" + metricId, function (metricId, tm, data) {
        var result = {};
        result.objectId = tm;
        result.object = data;
        res.write ( "event: database/" + databaseId + "/insert/" + metricId + "\n");
        res.write ( "id: " + counter + "\n");
        res.write ( "data: " + JSON.stringify(result) +"\n\n" );
        res.flush(); // !!! this is the important part if we use compression
        counter++;
      });

      tp.events.on("database/" + databaseId + "/delete/" + metricId, function (metricId, tm) {
        var result = {};
        result.objectId = tm;
        res.write ( "event: database/" + databaseId + "/delete/" + metricId + "\n");
        res.write ( "id: " + counter + "\n");
        res.write ( "data: " + JSON.stringify(result) +"\n\n" );
        res.flush(); // !!! this is the important part if we use compression
        counter++;
      });

      tp.events.on("database/" + databaseId + "/metric-delete/" + metricId, function (metricId) {
        var result = {};
        result.metricId = metricId;
        res.write ( "event: database/" + databaseId + "/metric-delete/" + metricId + "\n");
        res.write ( "id: " + counter + "\n");
        res.write ( "data: " + JSON.stringify(result) +"\n\n" );
        res.flush(); // !!! this is the important part if we use compression
        counter++;
      });

    } catch (e) {
      console.log(e);
      res.status(500).send(newErrorObject("500", "Internal Server Error", "ERROR", ""));
    }
  });

  app.post('/v1/databases', function(req, res) {
    let result = {};
    try {
      var start = process.hrtime();
      tp.createDb().then(data => {
        result.databaseId = data.databaseId;
        result.key = getSignature(data.databaseId);
        if (debug) {
          result.stats = getStats(start);
        }
        res.status(201).send(result);
      }).catch(error => {
        console.log(error);
        res.status(500).send(newErrorObject("500", "Internal Server Error", "ERROR", ""));
      });
    } catch (e) {
      console.log(e);
      res.status(500).send(newErrorObject("500", "Internal Server Error", "ERROR", ""));
    }
  });

  app.post('/v1/databases/:databaseId/metrics/:metricId/objects', function(req, res) {
    let result = {};
    try {
      var start = process.hrtime();
      var obj = req.body;
      var metricId = req.params.metricId.trim();
      var databaseId = req.params.databaseId.trim();
      let token = req.header('token');
      let action = req.header('x-action');


      var reg = new RegExp("^[0-9a-zA-Z-]+$");
      if (databaseId == 'undefined' || databaseId.length == 0 || !reg.test(databaseId)) {
        res.status(400).send("The \"databaseId\" path parameter can't be empty and only could be contain 0 to 9,a to z,A to Z and - characters");
        return;
      }

      if (!checkSignature (databaseId, token)) {
        res.status(403).send(newErrorObject("403", "Forbidden. Invalid token header.", "ERROR", ""));
        return;
      }

      if (action != 'single' && action!= 'bulk') {
        res.status(400).send("The \"X-Action\" header parameter can't be empty. Accepted values are single or bulk");
        return;
      }

      var reg = new RegExp("^[0-9a-zA-Z-]+$");
      if (metricId == 'undefined' || metricId.length == 0 || !reg.test(metricId)) {
        res.status(400).send(newErrorObject("400", "Bad Request", "ERROR", "The \"metricId\" path parameter can't be empty and only could be contain 0 to 9,a to z,A to Z and - characters"));
        return;
      }

      if (Object.keys(obj).length == 0) {
        res.status(400).send(newErrorObject("400", "Bad Request", "ERROR", "The \"body\" need to be contain a JSON object"));
        return;
      }

      if (isNaN(obj.tm)) {
        res.status(400).send(newErrorObject("400", "Bad Request", "ERROR", "The \"tm\" body property need to be a epoc datetime number"));
        return;
      }
      
      if (typeof obj.data === 'undefined') {
        res.status(400).send(newErrorObject("400", "Bad Request", "ERROR", "The \"data\" body need to be an Object"));
        return;
      }
  
      tp.setDatabaseId(databaseId);

      if (action=="single"){
        tp.insert(metricId, obj.tm, obj.data).then(data => {
          result.data = obj.data;
          result.tm = obj.tm;
          if (debug) {
            result.debug = data;
            result.stats = getStats(start);
          }
          res.status(201).send(result);
        }).catch(error => {
          console.log(error);
          res.status(500).send(newErrorObject("500", "Internal Server Error", "ERROR", ""));
        });
      }

      if (action=="bulk"){

        /*
        find the max number of files could be opened running this command on your console
        ulimit -n
        */

        (async(tp, metricId, values) => {
          let result = [];
          for(var i=0; i<values.length;i++) {
            try {
              let v = values[i];
              let res = await tp.insert(metricId, parseInt(v[0]), v[1]).catch(err => {
                console.log (err);
                result.push (err);
              });
              result.push (res);
            } catch (e) {
              result.push ('500');
              console.log (err);
            }
          }
          return result;
        })(tp, metricId, obj.data).then(data => {
          result.data = data;
          if (debug) {
            result.stats = getStats(start);
          }
          res.status(201).send(result);
        });

      }
    } catch (e) {
      console.log(e);
      res.status(500).send(newErrorObject("500", "Internal Server Error", "ERROR", ""));
    }
  });

 
  app.get('/v1/databases/:databaseId/metrics/:metricId/objects', function(req, res) {
    let result = {};
    try {
      var start = process.hrtime();
      let fr = req.query.fr;
      let to = req.query.to;
      let metric = req.params.metricId.trim();
      let databaseId = req.params.databaseId.trim();
      let token = req.header('token');

      if (!checkSignature (databaseId, token)) {
        res.status(403).send(newErrorObject("403", "Forbidden, invalid token header.", "ERROR", ""));
        return;
      }

      var reg = new RegExp("^[0-9a-zA-Z-]+$");
      if (databaseId == 'undefined' || databaseId.length == 0 || !reg.test(databaseId)) {
        res.status(400).send("The \"databaseId\" path parameter can't be empty and only could be contain 0 to 9,a to z,A to Z and - characters");
        return;
      }

      var reg = new RegExp("^[0-9a-zA-Z-]+$");
      if (metric.length == 0 || !reg.test(metric)) {
        res.status(400).send(newErrorObject("400", "Bad Request", "ERROR", "The \"metricId\" path parameter can't be empty and only could be contain 0 to 9,a to z,A to Z and - characters"));
        return;
      }

      if (isNaN(fr)) {
        res.status(400).send(newErrorObject("400", "Bad Request", "ERROR", "The \"fr\" query parameter need to be a epoc datetime number"));
        return;
      }

      if (isNaN(to)) {
        res.status(400).send(newErrorObject("400", "Bad Request", "ERROR", "The \"to\" query parameter need to be a epoc datetime number"));
        return;
      }

      fr = parseInt(fr);
      to = parseInt(to);

      tp.setDatabaseId(databaseId);
      tp.read(metric, fr, to).then(result => {
        if (debug) result.stats = getStats(start);
        res.status(200).send(result);
      }).catch(error => {
        if (error.msg == "404") {
          res.status(404).send(newErrorObject("404", "Metric doesn't exist", "ERROR", ""));
        } else {
          console.log(error);
          res.status(500).send(newErrorObject("500", "Internal Server Error", "ERROR", ""));
        }
      });
    } catch (e) {
      console.log(e);
      res.status(500).send(newErrorObject("500", "Internal Server Error", "ERROR", ""));
    }
  });

  app.delete('/v1/databases/:databaseId', function(req, res) {
    let databaseId = req.params.databaseId.trim();
    let token = req.header('token');

    if (!checkSignature (databaseId, token)) {
      res.status(403).send(newErrorObject("403", "Forbidden. Invalid token header.", "ERROR", ""));
      return;
    }
    
    tp.setDatabaseId(databaseId);
    tp.deleteDatabase().then(data => {
      res.status(204).send();
    }).catch(error => {
      if (error.msg == "404") {
        res.status(404).send(newErrorObject("404", "Database doesn't exist", "ERROR", ""));
      } else {
        console.log(error);
        res.status(500).send(newErrorObject("500", "Internal Server Error", "ERROR", ""));
      }
    });
  });

  app.delete('/v1/databases/:databaseId/metrics/:metricId', function(req, res) {
    let metric = req.params.metricId.trim();
    let databaseId = req.params.databaseId.trim();
    let token = req.header('token');

    if (!checkSignature (databaseId, token)) {
      res.status(403).send(newErrorObject("403", "Forbidden. Invalid token header.", "ERROR", ""));
      return;
    }

    var reg = new RegExp("^[0-9a-zA-Z-]+$");
    if (metric.length == 0 || !reg.test(metric)) {
      res.status(400).send("The \"metricId\" path parameter can't be empty and only could be contain 0 to 9,a to z,A to Z and - characters");
      return;
    }

    var reg = new RegExp("^[0-9a-zA-Z-]+$");
    if (databaseId == 'undefined' || databaseId.length == 0 || !reg.test(databaseId)) {
      res.status(400).send("The \"databaseId\" path parameter can't be empty and only could be contain 0 to 9,a to z,A to Z and - characters");
      return;
    }
    
    tp.setDatabaseId(databaseId);
    tp.deleteMetric(metric).then(data => {
      res.status(204).send();
    }).catch(error => {
      if (error.msg == "404") {
        res.status(404).send(newErrorObject("404", "Metric doesn't exist", "ERROR", ""));
      } else {
        console.log(error);
        res.status(500).send(newErrorObject("500", "Internal Server Error", "ERROR", ""));
      }
    });
  });

  app.delete('/v1/databases/:databaseId/metrics/:metricId/objects/:objectId', function(req, res) {
    let metricId = req.params.metricId.trim();;
    let objectId = req.params.objectId.trim();;
    let databaseId = req.params.databaseId.trim();
    let token = req.header('token');

    var reg = new RegExp("^[0-9a-zA-Z-]+$");
    if (databaseId == 'undefined' || databaseId.length == 0 || !reg.test(databaseId)) {
      res.status(400).send("The \"databaseId\" path parameter can't be empty and only could be contain 0 to 9,a to z,A to Z and - characters");
      return;
    }

    if (!checkSignature (databaseId, token)) {
      res.status(403).send(newErrorObject("403", "Forbidden. Invalid token header.", "ERROR", ""));
      return;
    }

    var reg = new RegExp("^[0-9a-zA-Z-]+$");
    if (metricId == 'undefined' || metricId.length == 0 || !reg.test(metricId)) {
      res.status(400).send("The \"metricId\" path parameter can't be empty and only could be contain 0 to 9,a to z,A to Z and - characters");
      return;
    }

    if (isNaN(objectId)) {
      res.status(400).send(newErrorObject("400", "Bad Request", "ERROR", "The \"tm\" query parameter need to be a epoc datetime number"));
      return;
    }
    objectId = parseInt(objectId);

    tp.setDatabaseId(databaseId);
    tp.delete(metricId, objectId).then(data => {
      res.status(204).send();
    }).catch(error => {
      if (error.msg == "404") {
        res.status(404).send(newErrorObject("404", "Metric-Value doesn't exist", "ERROR", ""));
      } else {
        console.log(error);
        res.status(500).send(newErrorObject("500", "Internal Server Error", "ERROR", ""));
      }
    });
  });



	freeport(config.port + (config.useCluster ? 1 : 0)).then(([freep]) => {
	  var server = app.listen(freep, function() {
		portNumber = freep;
		process.stdout.write('\x1Bc');
		let banner = "";
		banner+= "  _   _                         _     _           _          _ _     \n";
		banner+= " | | (_)                       | |   (_)         | |        | | |    \n";
		banner+= " | |_ _ _ __ ___   ___     ___ | |__  _  ___  ___| |_     __| | |__  \n";
		banner+= " | __| | '_ ` _ \\ / _ \\   / _ \\| '_ \\| |/ _ \\/ __| __|   / _` | '_ \\ \n";
		banner+= " | |_| | | | | | |  __/  | (_) | |_) | |  __/ (__| |_   | (_| | |_) |\n";
		banner+= "  \\__|_|_| |_| |_|\\___|   \\___/|_.__/| |\\___|\\___|\\__|   \\__,_|_.__/ \n";
		banner+= "                                    _/ |                             \n";
		banner+= "                                   |__/                              \n";
		console.log (banner);
		let url = config.protocol + "://" + config.hostname + ":" + server.address().port;
		console.log("Server running on: " + url);
		console.log ("Server CPU's: " + require('os').cpus().length);

		var chieldProc = require('child_process');
		chieldProc.exec('ulimit -n', function (error, stdout, stderr) {
		  console.log('Max file descriptors [ulimit]: ' + stdout);
		})

		if (config.useCluster) process.send({ url: url });

	  })
	}).catch((err)=>{
		console.error(err);
	});

}

function getStats(hrstart) {
  let stats = {}
  stats.memoryUsage = {};
  const used = process.memoryUsage();
  for (const [key, value] of Object.entries(used)) {
    stats.memoryUsage[key] = Math.round(value / 1024 / 1024 * 100) / 100 + ' MB';
  }
  var hrend = process.hrtime(hrstart);
  stats.executionTime = hrend[0] + "." + (parseInt(hrend[1] / 1000000)) + " s";
  return stats;
}

function newErrorObject(code, description, level, message) {
  let result = {};
  result.code = code;
  result.description = description;
  result.level = level; //[INFO, ERROR, WARNING, FATAL]
  result.message = message;
  return result;
}

function checkSignature (databaseId, token){
  var selfToken = getSignature(databaseId);
  return selfToken == token;
}

function getSignature(databaseId) {
  var crypto = require('crypto');
  var hmac = crypto.createHmac('sha256', config.secretKey);
  var data = hmac.update(databaseId);
  var gen_hmac= data.digest('hex');
  return gen_hmac;
}

Number.prototype.padLeft = function(base,chr){
    var len = (String(base || 10).length - String(this).length)+1;
    return len > 0? new Array(len).join(chr || '0')+this : this;
}

Date.prototype.rfc3339 = function(){
  var dformat = this.getFullYear() + "-" + 
              new Number((this.getMonth()+1)).padLeft() + "-" + 
              new Number(this.getDate()).padLeft() + "T" +
              new Number(this.getHours()).padLeft() + ":" +
              new Number(this.getMinutes()).padLeft() + ":" +
              new Number(this.getSeconds()).padLeft() + "Z";
  return dformat;
}
