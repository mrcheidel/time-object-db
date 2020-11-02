const objdb = new require('.././lib/time-objects-db.js');
fs = require('fs');    

var tp = new objdb({"basepath": __dirname + "/../data/"});

tp.createDb().then(data => {
	fs.writeFile('db-config.json', JSON.stringify(data,null,2), function (err) {
  		if (err) return console.log(err);
		console.log (data)
	});
});



