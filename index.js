'use strict';

const express = require('express');
const app = express();
const cors = require('cors');
const objdb = require('./lib/time-objects-db.js');
const bodyParser = require('body-parser');
const compression = require('compression');

let database = "4c49c2a0-11fa-11ea-969b-5f0da336b8d7" ;//require('uuid/v1')();
let debug = true;
let tp = new objdb({"basepath": __dirname + "/data/"});

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
app.use(bodyParser.json());
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
  res.sendFile(__dirname + '/doc/swagger.yaml');
});


app.delete('/databases/:databaseId', function(req, res) {
  let databaseId = req.params.databaseId.trim();

  var reg = new RegExp("^[0-9a-zA-Z-]+$");
  if (databaseId.length == 0 || !reg.test(databaseId)) {
    res.status(400).send("The \"databaseId\" path parameter can't be empty and only could be contain 0 to 9,a to z,A to Z and - characters");
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




app.delete('/databases/:databaseId/metrics/:metricId', function(req, res) {
  let metric = req.params.metricId.trim();
  let databaseId = req.params.databaseId.trim();

  var reg = new RegExp("^[0-9a-zA-Z-]+$");
  if (metric.length == 0 || !reg.test(metric)) {
    res.status(400).send("The \"metricId\" path parameter can't be empty and only could be contain 0 to 9,a to z,A to Z and - characters");
    return;
  }

  var reg = new RegExp("^[0-9a-zA-Z-]+$");
  if (databaseId.length == 0 || !reg.test(databaseId)) {
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

app.delete('/databases/:databaseId/metrics/:metricId/object/:objectId', function(req, res) {
  let metricId = req.params.metricId.trim();;
  let objectId = req.params.objectId.trim();;
  let databaseId = req.params.databaseId.trim();

  var reg = new RegExp("^[0-9a-zA-Z-]+$");
  if (metricId.length == 0 || !reg.test(metricId)) {
    res.status(400).send("The \"metricId\" path parameter can't be empty and only could be contain 0 to 9,a to z,A to Z and - characters");
    return;
  }

  if (isNaN(objectId)) {
    res.status(400).send(newErrorObject("400", "Bad Request", "ERROR", "The \"tm\" query parameter need to be a epoc datetime number"));
    return;
  }
  objectId = parseInt(objectId);

  var reg = new RegExp("^[0-9a-zA-Z-]+$");
  if (databaseId.length == 0 || !reg.test(databaseId)) {
    res.status(400).send("The \"databaseId\" path parameter can't be empty and only could be contain 0 to 9,a to z,A to Z and - characters");
    return;
  }
  
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

app.get('/databases/:databaseId/metrics/:metricId/events', function(req, res) {
  let result = {};
  try {
    var start = process.hrtime();
    let metricId = req.params.metricId.trim();
    let databaseId = req.params.databaseId.trim();

    var reg = new RegExp("^[0-9a-zA-Z-]+$");
    if (metricId.length == 0 || !reg.test(metricId)) {
      res.status(400).send(newErrorObject("400", "Bad Request", "ERROR", "The \"metricId\" path parameter can't be empty and only could be contain 0 to 9,a to z,A to Z and - characters"));
      return;
    }

    var reg = new RegExp("^[0-9a-zA-Z-]+$");
    if (databaseId.length == 0 || !reg.test(databaseId)) {
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

app.post('/databases/:databaseId/metrics/:metricId/objects', function(req, res) {
  let result = {};
  try {
    var start = process.hrtime();
    var obj = req.body;
    var metricId = req.params.metricId.trim();

    var reg = new RegExp("^[0-9a-zA-Z-]+$");
    if (metricId.length == 0 || !reg.test(metricId)) {
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

    let databaseId = req.params.databaseId;
    var reg = new RegExp("^[0-9a-zA-Z-]+$");
    if (databaseId.length == 0 || !reg.test(databaseId)) {
      res.status(400).send("The \"databaseId\" path parameter can't be empty and only could be contain 0 to 9,a to z,A to Z and - characters");
      return;
    }
    
    tp.setDatabaseId(databaseId);
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

  } catch (e) {
    console.log(e);
    res.status(500).send(newErrorObject("500", "Internal Server Error", "ERROR", ""));
  }
});

app.get('/databases/:databaseId/metrics/:metricId/objects', function(req, res) {
  let result = {};
  try {
    var start = process.hrtime();
    let fr = req.query.fr;
    let to = req.query.to;
    let metric = req.params.metricId.trim();
    let databaseId = req.params.databaseId.trim();

    var reg = new RegExp("^[0-9a-zA-Z-]+$");
    if (databaseId.length == 0 || !reg.test(databaseId)) {
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

var server = app.listen(8000, function() {
  console.log("Server Running on port " + server.address().port);
})

function newErrorObject(code, description, level, message) {
  let result = {};
  result.code = code;
  result.description = description;
  result.level = level; //[INFO, ERROR, WARNING, FATAL]
  result.message = message;
  return result;
}