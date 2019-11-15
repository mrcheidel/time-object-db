const objdb = new require('.././lib/time-objects-db.js');
    
let metric = "metricId1";
let qty = 150;

var tp = new objdb({"basepath": __dirname + "/../data/"});
if (tp.metricExist(metric)){
  tp.delete(metric).then(data => {
    console.log ("Metric " + metric + " has been deleted.");
  }).catch (error => {
    console.log (error);
  });
} else {
  console.log ("Metric " + metric + " doesn't exist.");
}
