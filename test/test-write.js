const objdb = new require('.././lib/time-objects-db.js');
    
let metric = "metricId";
let qty = 200;

var tp = new objdb({
  "basepath": __dirname + "/data/",
  "period": 600,
  "limit": 300}
);

tp.delete(metric).then(data => {
  console.log ("Metric " + metric + " has been deleted.");
  //insert(tp);
}).catch (error => {
  console.log (error);
  insert(tp);

});

function insert(tp){
    let tm  = parseInt(new Date().getTime()/1000);

    let obj = {};
    obj.tm = tm;
    for (var i=0; i < qty; i++){
      obj.tm = obj.tm + i;
      obj.firstName = "Claudio";
      obj.lastName = "Heidel Schemberger";
      obj.gender = "Male";
      obj.department = "Architecture";
      obj.city = "Madrid";
      obj.country = "Spain";

      tp.write (metric, obj.tm, obj).then(data  => {
          //console.log (data);
      }).catch (error => {
          console.log (error);
      });
    }
    console.log ("Metric " + metric + " created.");
}

 


