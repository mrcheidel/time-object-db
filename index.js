'use strict';

const express = require('express');
const app = express();
const cors = require('cors');
const objdb = new require('./lib/time-objects-db.js');
const bodyParser = require('body-parser');

let debug = true;

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

app.delete ('/metrics/:metric',  function (req, res) {
  let metric = req.params.metric;
  var reg = new RegExp("^[a-zA-Z]+$");
  if (metric.length == 0 || !reg.test(metric)) {
    res.status(400).send("The \"metric\" path parameter can't be empty and only could be contain a-zA-Z characters");
    return;
  }
  var tp = new objdb({"basepath": __dirname + "/data/"});
  tp.reset(metric);
  if(debug) console.log ("Metric " + metric + " has been deleted.");
  res.status(204).send();
});

app.post ('/metrics/:metric',  function (req, res) {
  let result = {};
  try {
    let start = new Date();
    var obj = req.body;
    var metric = req.params.metric.trim();
    let tm = parseInt(new Date().getTime()/1000);

    var reg = new RegExp("^[a-zA-Z]+$");
    if (metric.length == 0 || !reg.test(metric)) {
      res.status(400).send(newErrorObject ("400", "Bad Request", "ERROR","The \"metric\" path parameter can't be empty and only could be contain a-zA-Z characters"));
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

    tp.write (metric, tm, obj).then(data  => {
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

app.get ('/metrics/:metric',  function (req, res) {
  let result = {};
  try {
    let start = new Date();
    let fr     = req.query.fr;
    let to     = req.query.to;
    let metric = req.params.metric.trim();

    var reg = new RegExp("^[a-zA-Z]+$");
    if (metric.length == 0 || !reg.test(metric)) {
      res.status(400).send(newErrorObject ("400", "Bad Request", "ERROR","The \"metric\" path parameter can't be empty and only could be contain a-zA-Z characters"));
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
      "limit": 300}
    );

    fr     = parseInt(fr);
    to     = parseInt(to);

    tp.read (metric, fr, to).then (result => {
        if(debug) result.stats = getStats(start);
        res.status(200).send(result);
        if(debug) console.log ("New search on the metric " + metric + " as been executed [fr= "+ fr +" & to=" + to +"].");
    }).catch (error => {
      console.log (error);
      res.status(500).send(newErrorObject ("500", "Internal Server Error", "ERROR",""));
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

var server = app.listen(null, function () {
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