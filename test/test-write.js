const objdb = new require('.././lib/time-objects-db.js');
const fs = require('fs'); 

var tp = new objdb({"basepath": __dirname + "/../data/"});
let databaseId = JSON.parse(fs.readFileSync('db-config.json', {encoding:'utf8', flag:'r'})).databaseId;           
tp.setDatabaseId(databaseId);

let metric = "metricId1";
let qty = 100000;

if (tp.metricExist(metric)){
  tp.deleteMetric(metric).then(data => {
    console.log ("Metric " + metric + " has been deleted.");
    insert(tp);

  }).catch (error => {
    console.log (error);
  });
} else {
	insert(tp);
}

async function read(metric, fr, to){
    console.log ("fr: "+ fr + " to: " +to);
    await tp.read (metric, fr, to).then (result => {
      console.log (result);
    }).catch (error => {
      console.log (error);
    });
}

async function insert(tp){
    let tm  = 1573720000;
    let ap = [];
    var hrstart = process.hrtime();

    for (var i=0; i < qty; i++){
      let obj = {};
      obj.tm = (tm + i);
      obj.firstName = "Claudio";
      obj.lastName = "Heidel";
      obj.gender = "Male";
      obj.department = "Architecture";
      obj.city = "Madrid";
      obj.country = "Spain";

      //await tp.insert (metric, obj.tm , obj).catch(err => {console.log (err)});
      tp.insert (metric, obj.tm , obj).catch(err => {console.log (err)});
    }

 	var hrend = process.hrtime(hrstart);
	await read(metric, 1573720100, 1573720110); 
	console.log (hrend[0] + "." + (parseInt(hrend[1] / 1000000)) + " s");
	process.exit();
}
