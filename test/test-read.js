const objdb = new require('.././lib/time-objects-db.js');  

let metric = "metricId1"; 
let tp = new objdb({"basepath": __dirname + "/../data/", "filter": filter});
let tm  = 1573720000;


let fr = tm+100;
let to = tm+120;
console.log ("fr: "+ fr + " to: " +to);


function filter (items){
	return items.filter(item => item.tm == "1573720110" || item.key == "value1");
}

tp.read (metric, fr, to).then (result => {
  console.log ("Without Filter");
  console.log (result);
}).catch (error => {
  console.log (error);
});

tp.read (metric, fr, to, filter).then (result => {
  console.log ("With Filter");
  console.log (result);
}).catch (error => {
  console.log (error);
});

