const objdb = new require('.././lib/time-objects-db.js');
    
let metric = "metricId1";
let qty = 1000;

var tp = new objdb({"basepath": __dirname + "/../data/"});
console.log (tp.basepath);


if (tp.metricExist(metric)){
  tp.clear(metric).then(data => {
    console.log ("Metric " + metric + " has been deleted.");
    insert(tp);
  }).catch (error => {
    console.log (error);
  });
} else {
	insert(tp);
}



async function insert(tp){
    let tm  = 1573720000;
    let ap = [];
    var hrstart = process.hrtime();

    for (var i=0; i < qty; i++){
      var obj = {};
      obj.tm = tm + (i * 10) ;
      obj.firstName = "Claudio";
      obj.lastName = "Heidel Schemberger";
      obj.gender = "Male";
      obj.department = "Architecture";
      obj.city = "Madrid";
      obj.country = "Spain";
      await tp.insert (metric, obj.tm , obj).catch(err => {console.log (err)});
    }

    let fr = tm +100;
    let to = tm +110;
    console.log ("fr: "+ fr + " to: " +to);

    await tp.read (metric, fr, to).then (result => {
      console.log (result);
    }).catch (error => {
      console.log (error);
    });
    
 	var hrend = process.hrtime(hrstart);
	console.log (hrend[0] + "." + (parseInt(hrend[1] / 1000000)) + " s");

}
