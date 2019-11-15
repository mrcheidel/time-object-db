'use strict';

const express = require('express');
const app = express();
const cors = require('cors');
const objdb = new require('./lib/time-objects-db.js');
const bodyParser = require('body-parser');

let debug = false;

app.disable('x-powered-by');
app.use(cors());
app.use(bodyParser.json());
app.use('/doc', express.static(__dirname + '/doc'));

app.use(function (error, req, res, next) {
  if (error instanceof SyntaxError) {
    console.log (error);
    res.status(400).send(newErrorObject ("400", "Bad Request", "ERROR", error.type));
  } else {
    next();
  }
});

app.get ('/',  function (req, res) {
  var showdown  = require('showdown');
  var fs = require("fs");
  var str = fs.readFileSync("README.md", "utf8");
  var converter = new showdown.Converter({metadata: true});
  converter.setOption('completeHTMLDocument', true);
  var html = converter.makeHtml(str);
  res.status(200).send(html);
});

app.get ('/contract',  function (req, res) {
  res.sendFile(__dirname + '/doc/swagger.yaml');
});

app.delete ('/metrics/:metricId/clear',  function (req, res) {
  let metric = req.params.metricId;
  var reg = new RegExp("^[0-9a-zA-Z-]+$");
  if (metric.length == 0 || !reg.test(metric)) {
    res.status(400).send("The \"metricId\" path parameter can't be empty and only could be contain 0 to 9,a to z,A to Z and - characters");
    return;
  }
  var tp = new objdb({"basepath": __dirname + "/data/"});
  tp.clear(metric).then(data => {
    if(debug) console.log ("Metric " + metric + " has been deleted.");
    res.status(204).send();
  }).catch (error => {
    if(error.msg == "404") {
      res.status(404).send(newErrorObject ("404", "Metric doesn't exist", "ERROR",""));
    } else {
      console.log (error);
      res.status(500).send(newErrorObject ("500", "Internal Server Error", "ERROR",""));
    }
  });
});

app.delete ('/metrics/:metricId',  function (req, res) {
  let metric = req.params.metricId;
  let tm     = req.query.tm;
  
  var reg = new RegExp("^[0-9a-zA-Z-]+$");
  if (metric.length == 0 || !reg.test(metric)) {
    res.status(400).send("The \"metricId\" path parameter can't be empty and only could be contain 0 to 9,a to z,A to Z and - characters");
    return;
  }
  
  if (isNaN(tm)) {
    res.status(400).send(newErrorObject ("400", "Bad Request", "ERROR","The \"tm\" query parameter need to be a epoc datetime number"));
    return;
  }
  
  tm = parseInt(tm);
  var tp = new objdb({"basepath": __dirname + "/data/"});
  tp.delete(metric, tm).then(data => {
    if(debug) console.log ("Metric " + metric + " value = " + tm + " has been deleted.");
    res.status(204).send();
  }).catch (error => {
    if(error.msg == "404") {
      res.status(404).send(newErrorObject ("404", "Metric-Value doesn't exist", "ERROR",""));
    } else {
      console.log (error);
      res.status(500).send(newErrorObject ("500", "Internal Server Error", "ERROR",""));
    }
  });
});



app.post ('/metrics/:metricId',  function (req, res) {
  let result = {};
  try {
    let start = new Date();
    var obj = req.body;
    var metric = req.params.metricId.trim();
    let tm = parseInt(new Date().getTime()/1000);

    var reg = new RegExp("^[0-9a-zA-Z-]+$");
    if (metric.length == 0 || !reg.test(metric)) {
      res.status(400).send(newErrorObject ("400", "Bad Request", "ERROR","The \"metricId\" path parameter can't be empty and only could be contain 0 to 9,a to z,A to Z and - characters"));
      return;
    }

    if (Object.keys(obj).length == 0) {
      res.status(400).send(newErrorObject ("400", "Bad Request", "ERROR","The \"body\" need to be contain a JSON object"));
      return;
    } 

    if (isNaN(obj.tm)) {
      res.status(400).send(newErrorObject ("400", "Bad Request", "ERROR","The \"tm\" body property need to be a epoc datetime number"));
      return;
    }
 
    if (obj.tm !== undefined) {tm = obj.tm;}

    var tp = new objdb({
      "basepath": __dirname + "/data/",
      "period": 600,
      "limit": 300}
    );

    tp.insert (metric, tm, obj).then(data  => {
        result.data = req.body;
        if (debug) {
          result.debug = data;
          result.stats= getStats(start);
        }

        res.status(201).send(result);
        if(debug) console.log ("New object for the metric " + metric + " has been created.");
    }).catch (error => {
        console.log (error);
        res.status(500).send(newErrorObject ("500", "Internal Server Error", "ERROR",""));
    });

  } catch (e) {
    console.log (e);
    res.status(500).send(newErrorObject ("500", "Internal Server Error", "ERROR",""));
  } 
});

app.get ('/metrics/:metricId',  function (req, res) {
  let result = {};
  try {
    let start = new Date();
    let fr     = req.query.fr;
    let to     = req.query.to;
    let metric = req.params.metricId.trim();

    var reg = new RegExp("^[0-9a-zA-Z-]+$");
    if (metric.length == 0 || !reg.test(metric)) {
      res.status(400).send(newErrorObject ("400", "Bad Request", "ERROR","The \"metricId\" path parameter can't be empty and only could be contain 0 to 9,a to z,A to Z and - characters"));
      return;
    }

    if (isNaN(fr)) {
      res.status(400).send(newErrorObject ("400", "Bad Request", "ERROR","The \"fr\" query parameter need to be a epoc datetime number"));
      return;
    }

    if (isNaN(to)) {
      res.status(400).send(newErrorObject ("400", "Bad Request", "ERROR","The \"to\" query parameter need to be a epoc datetime number"));
      return;
    }

    let tp = new objdb({
      "basepath": __dirname + "/data/",
      "period": 600,
      "limit": 300
      }
    );

    fr     = parseInt(fr);
    to     = parseInt(to);

    tp.read (metric, fr, to).then (result => {
        if(debug) result.stats = getStats(start);
        res.status(200).send(result);
        if(debug) console.log ("New search on the metric " + metric + " as been executed [fr= "+ fr +" & to=" + to +"].");
    }).catch (error => {
      if(error.msg == "404") {
        res.status(404).send(newErrorObject ("404", "Metric doesn't exist", "ERROR",""));
      } else {
        console.log (error);
        res.status(500).send(newErrorObject ("500", "Internal Server Error", "ERROR",""));
      }
    });
  } catch (e) {
    console.log (e);
    res.status(500).send(newErrorObject ("500", "Internal Server Error", "ERROR",""));
  } 
});

function getStats(startTime){
  let stats = {}
  stats.memoryUsage = {};
  const used = process.memoryUsage();
  for (const [key, value] of Object.entries(used)) {
    stats.memoryUsage[key] = Math.round(value / 1024 / 1024 * 100) / 100 + ' MB';
  }
  var hrstart = process.hrtime();
  var end = new Date() - startTime, hrend = process.hrtime(hrstart);
  stats.executionTime = hrend[1] / 1000000;
  return stats;
}

var server = app.listen(8000, function () {
   console.log ("Server Running on port " + server.address().port);
})

function newErrorObject (code, description, level,message){
  let result = {};
  result.code = code; 
  result.description = description; 
  result.level = level; //[INFO, ERROR, WARNING, FATAL]
  result.message = message;
  return result;
}