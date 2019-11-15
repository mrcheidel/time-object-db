const objdb = new require('.././lib/time-objects-db.js');
    
let metric = "metricId1";
let qty = 150;

var tp = new objdb({"basepath": __dirname + "/../data/"});
if (tp.metricExist(metric)){
  tp.delete(metric, 1573720020).then(data => {
    console.log (data);
    
let tm  = 1573720000;
let fr = tm;
let to = tm+20;

metric = "metricId1";
tp.read (metric, fr, to).then (result => {
  console.log (result);
}).catch (error => {
  console.log (error);
});

    
    
    
    
  }).catch (error => {
    console.log (error);
  });
} else {
  console.log ("Metric " + metric + " doesn't exist.");
}
