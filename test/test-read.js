const objdb = new require('.././lib/time-objects-db.js');  
const fs = require('fs'); 

var tp = new objdb({"basepath": __dirname + "/../data/"});
let databaseId = JSON.parse(fs.readFileSync('db-config.json', {encoding:'utf8', flag:'r'})).databaseId;           
tp.setDatabaseId(databaseId);

let metric = "metricId1"; 
let tm  = 1573720000;


let fr = tm+100;
let to = tm+120;
console.log ("fr: "+ fr + " to: " +to);

/* 
https://stackoverflow.com/questions/6491463/accessing-nested-javascript-objects-and-arays-by-string-path
const resolvePath = (object, path, defaultValue) => path
   .split('.')
   .reduce((o, p) => o ? o[p] : defaultValue, object)
*/


tp.read (metric, fr, to).then (result => {
  console.log ("Without Filter");
  console.log (result);
}).catch (error => {
  console.log (error);
});


var filterQuery1 = { m: "tm", o: "==", v: 1573720110 };//simpe query
var filterQuery2 = { m: "item.size", o: ">", v: 8 };
var filterQuery3 = {lo: "&&", v: [{ m: "tm", o: "==", v: 1573720110 }, { m: "firstName", o: "==", v: "Claudio" }]}; //composite query

tp.read (metric, fr, to, filterQuery1).then (result => {
  console.log ("With Filter");
  console.log (result);
}).catch (error => {
  console.log (error);
});




