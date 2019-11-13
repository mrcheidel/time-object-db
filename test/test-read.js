const objdb = new require('.././lib/time-objects-db.js');  
let metric = "metricId"; 
let tm  = parseInt(new Date().getTime()/1000);
    
var tp = new objdb({
  "basepath": __dirname + "/data/",
  "period": 600,
  "limit": 300}
);

tp.read (metric, tm+100, tm+105).then (result => {
  console.log (result);
}).catch (error => {
  console.log (error);
});
