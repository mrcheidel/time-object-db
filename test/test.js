const objdb = new require('.././lib/time-objects-db.js');
    
let metric = "metricId1";
let qty = 100000;

var tp = new objdb({"basepath": __dirname + "/../data/"});
if (tp.metricExist(metric)){
  tp.delete(metric).then(data => {
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

    for (var i=0; i < qty; i++){
      var obj = {};
      obj.tm = tm + (i * 10) ;
      obj.firstName = "Claudio";
      obj.lastName = "Heidel Schemberger";
      obj.gender = "Male";
      obj.department = "Architecture";
      obj.city = "Madrid";
      obj.country = "Spain";
      await tp.write (metric, obj.tm , obj);
    }

    let fr = tm +100;
    let to = tm +120;
    console.log ("fr: "+ fr + " to: " +to);

    tp.read (metric, fr, to).then (result => {
      console.log (result);
    }).catch (error => {
      console.log (error);
    });
 
}

 


