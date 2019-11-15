const objdb = new require('.././lib/time-objects-db.js');  

let metric = "metricId1"; 
let tp = new objdb({"basepath": __dirname + "/../data/"});
let tm  = 1573720000;


let fr = tm+100;
let to = tm+120;
console.log ("fr: "+ fr + " to: " +to);

tp.read (metric, fr, to).then (result => {
  console.log (result);
}).catch (error => {
  console.log (error);
});
