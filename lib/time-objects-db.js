'use strict';
const AVLTree = require('binary-search-tree').AVLTree // 
const fs = require('fs');
const path = require('path');
const fs2 = require('fs-extra');
//const events = require('events');
const events = require('cluster-events');

function timeObjectDB(config) {
  this.base = path.resolve(config.basepath || __dirname + "/data") + "/"
  this.basepath = ""
  this.databaseId = "";
  this.period = config.period || 600;
  this.limit = config.limit || 300;
  this.ext = ".dat";
  this.indexname = "index.dat";
  this.events = new events.EventEmitter("time-object-database");
}

timeObjectDB.prototype.setDatabaseId = function(databaseId) {
  this.databaseId = databaseId;
  this.basepath = this.base + this.databaseId.trim() + "/";
};

timeObjectDB.prototype.getFirstLast = function(metric) {
  var result = {
    "min": null,
    "max": null
  };
  return new Promise((resolve, reject) => {
    readData(this.basepath + metric + "/index" + this.ext).then(data => {
      let mainIndex = new AVLTree();
      data.forEach(item => {
        mainIndex.insert(item._tm, item._data);
      });
      //main index
      let min = mainIndex.search(mainIndex.tree.getMinKey());
      let max = mainIndex.search(mainIndex.tree.getMaxKey());
      let ap = [];
      if (min.length == 0 || max.length == 0) resolve(result);
      ap.push(readData(min[0].index));
      ap.push(readData(max[0].index));
      Promise.all(ap).then(values => {
        let tmp = [].concat.apply([], values);
        let mmIndex = new AVLTree();
        tmp.forEach(item => {
          if (item._tm && item._data) {
            mmIndex.insert(item._tm, item._data);
          }
        });
        //second level index 
        let min = mmIndex.search(mmIndex.tree.getMinKey());
        let max = mmIndex.search(mmIndex.tree.getMaxKey());
        let ap = [];
        ap.push(readData(min[0].path + min[0].file));
        ap.push(readData(max[0].path + max[0].file));
        Promise.all(ap).then(values => {
          let tmp = [].concat.apply([], values);
          let xIndex = new AVLTree();
          tmp.forEach(item => {
            if (item._tm && item._data) {
              xIndex.insert(item._tm, item._data);
            }
          });
          //final data min & max
          let result = {};
          result.min = xIndex.tree.getMinKey();
          result.max = xIndex.tree.getMaxKey();
          resolve(result);
        });
      });
    }).catch(reason => {
      reject(reason);
    });
  });
}

timeObjectDB.prototype.getL1 = function(d) {
  let yyyy = d.getFullYear();
  let mm = (d.getMonth() + 1).toString();
  if (mm.length < 2) mm = "0" + mm;
  return yyyy + "-" + mm;
}

timeObjectDB.prototype.getL2 = function(d) {
  return d.toISOString().split('T')[0].split('-')[2];
}

timeObjectDB.prototype.getL3 = function(epoc) {
  var f1a = parseInt(epoc / 86400) * 86400; //split by days
  var f1b = parseInt((epoc - f1a) / this.period) * this.period; //split each 5 minutes
  return (f1a + f1b);
}

timeObjectDB.prototype.read = function(metric, fromEpoc, toEpoc) {
  let result = {};
  let ap = [];
  return new Promise((resolve, reject) => {
    try {
      if (!this.metricExist(metric)) {
        result.msg = "404";
        reject(result);
      }
      this.getIndexes(metric, fromEpoc, toEpoc).then(data => {
        let bstIndex = new AVLTree();
        data.forEach(item => {
          if (item._tm && item._data) {
            bstIndex.insert(item._tm, item._data);
          }
        });
        let fpa = bstIndex.betweenBounds({
          $lte: this.getL3(toEpoc),
          $gte: this.getL3(fromEpoc)
        });
        fpa.forEach(fp => {
          ap.push(readData(fp.path + fp.file))
        });
        Promise.all(ap).then(values => {
          let tmp = [].concat.apply([], values);
          let bst = new AVLTree();
          tmp.forEach(item => {
            if (item._tm && item._data) {
              if (item._a == "I") {
                bst.insert(item._tm, item._data);
              }
              if (item._a == "D") {
                bst.delete(item._tm);
              }
            }
          });
          result.data = bst.betweenBounds({
            $lte: toEpoc,
            $gte: fromEpoc
          }).slice(0, this.limit);
          result.self = {};
          result.self.find = result.data.length;
          result.self.limit = this.limit;
          this.getFirstLast(metric).then(mm => {
            result.self.min = mm.min;
            result.self.max = mm.max;
            resolve(result);
            this.events.emit("database/" + this.databaseId + "/read/" + metric, metric, fromEpoc, toEpoc);
          });
        }).catch(reason => {
          result.error = reason;
          reject(result);
        });
      }).catch(reason => {
        result.error = reason;
        reject(result);
      });
    } catch (e) {
      result.error = e;
      reject(result);
    }
  });
}

timeObjectDB.prototype.insert = function(metricId, tm, data) {
  return this.write(metricId, tm, data, "I");
}

timeObjectDB.prototype.delete = function(metricId, tm) {
  let result = {};
  return new Promise((resolve, reject) => {
    if (metricId==null || tm==null) {
      result.msg = "403";
      reject(result);
    }
    this.read(metricId, tm, tm).then(data => {
      if (data.data.length > 0) {
        resolve(this.write(metricId, tm, {}, "D"));
      } else {
        result.msg = "404";
        reject(result);
      }
    }).catch(err => {
      reject(err);
    })
  });
}

/*
action -> I=Insert - D=delete
*/
timeObjectDB.prototype.write = function(metricId, tm, data, action) {
  return new Promise((resolve, reject) => {
    try {
      if (isNaN(tm)) reject("500.1");
      let fp = this.getPathFromEpoc(metricId, tm);
      let _idata = {
        "_tm": tm,
        "_a": action,
        "_data": data
      };
      let _data = stringify(_idata) + "\n";
      let _file = fp.path + fp.file;
      if (!fs.existsSync(fp.path)) {
        try {
          fs.mkdirSync(fp.path, {
            recursive: true
          });
        } catch (err) {
          reject(err);
        }
      }
      this.updateIndex(metricId, _file, fp).then(result => {
/*
        try {
          fs.appendFileSync(_file, _data);
          if (action =="I") this.events.emit("database/" + this.databaseId + "/insert/" + metricId, metricId, tm, data);
          if (action =="D") this.events.emit("database/" + this.databaseId + "/delete/" + metricId, metricId, tm);
          resolve("201");
        } catch (e){
         reject(e);
        }
*/

        fs.appendFile(_file, _data, (err) => {
          if (err) reject(err);
          if (action =="I") this.events.emit("database/" + this.databaseId + "/insert/" + metricId, metricId, tm, data);
          if (action =="D") this.events.emit("database/" + this.databaseId + "/delete/" + metricId, metricId, tm);
          resolve("201");
        });

      }).catch(error => {
        reject(error);
      });
    } catch (e) {
      reject(e);
    }
  });
}

timeObjectDB.prototype.metricExist = function(metricId) {
  return fs.existsSync(this.basepath + metricId);
}

timeObjectDB.prototype.getPathFromEpoc = function(metric, epoc) {
  let res = {
    "path": null,
    "file": null,
    "l1": null,
    "l2": null,
    "l3": null
  };
  try {
    if (isNaN(epoc)) return path;
    if (epoc > 253402300799) return path; // max 9990-12-31T23:59:59
    var d = new Date(epoc * 1000);
    var l1 = this.getL1(d);
    var l2 = this.getL2(d);
    var l3 = this.getL3(epoc);
    res.path = this.basepath + metric + "/" + l1 + "/" + l2 + "/";
    res.file = l3 + this.ext;
    res.l1 = l1;
    res.l2 = l2;
    res.l3 = l3;
  } catch (e) {
    console.log(e);
  } finally {
    return res;
  }
}

timeObjectDB.prototype.checkIndex = function(_BRecreate) {
  //TODO
  // Verify if the index is aligned and Recreate it if is necesary
}

timeObjectDB.prototype.exitDbSync = function (databaseId) {
  this.setDatabaseId(databaseId);
  return fs.existsSync(this.basepath);
}

timeObjectDB.prototype.createDb = function () {
  let result = {};
  return new Promise((resolve, reject) => {
    try {
      let databaseId = require('uuid/v4')();
      this.setDatabaseId(databaseId);
      result.databaseId = databaseId;
      if (!fs.existsSync(this.basepath)) {
        try {
          fs.mkdirSync(this.basepath, {recursive: true});
          result.code = "201";
          resolve(result);
        } catch (err) {
          reject(err);
        }
      } else {
        result.code = "200";
        resolve(result);
      }
    } catch (err) {
      reject(err);
    };
  });
}


timeObjectDB.prototype.deleteDatabase = function() {
  let result = {};
  return new Promise((resolve, reject) => {
    if (!this.metricExist("")) {
      result.msg = "404";
      reject(result);
    }
    fs2.removeSync(this.basepath);
    this.events.emit("database/" + this.databaseId + "/database-delete",  this.databaseId);
    resolve("204");
  });
}


timeObjectDB.prototype.deleteMetric = function(_metric) {
  let result = {};
  return new Promise((resolve, reject) => {
    if (!this.metricExist(_metric)) {
      result.msg = "404";
      reject(result);
    }
    fs2.removeSync(this.basepath + "/" + _metric);
    this.events.emit("database/" + this.databaseId + "/metric-delete/" + _metric, _metric);
    resolve("204");
  });
}

timeObjectDB.prototype.getIndexes = function(_metric, fromEpoc, toEpoc) {
  return new Promise((resolve, reject) => {
    var ap = [];
    var frDate = new Date(fromEpoc * 1000);
    var toDate = new Date(toEpoc * 1000);
    while (this.getL1(frDate) <= this.getL1(toDate)) {
      ap.push(readData(this.basepath + _metric + "/" + this.getL1(frDate) + "/" + this.indexname));
      frDate = new Date(frDate.setMonth(frDate.getMonth() + 1));
    }
    Promise.all(ap).then(values => {
      let result = [].concat.apply([], values);
      resolve(result);
    }).catch(reason => {
      console.log(reason);
      reject([]);
    });
  });
};

timeObjectDB.prototype.updateIndex = function(_metric, _file, _data) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(_file)) {
      let newEntry = this.basepath + _metric + "/" + _data.l1 + "/" + this.indexname;
      if (!fs.existsSync(newEntry)) {
        let tm = parseInt(new Date(_data.l1 + '-01').getTime() / 1000);
        let data = {
          "index": newEntry
        };
/*
        try {
          fs.appendFileSync(this.basepath + _metric + "/" + this.indexname,
                          stringify({"_tm": tm, "_data": data}) + "\n");
          fs.appendFileSync(newEntry, stringify({"_tm": _data.l3,"_data": _data}) + "\n");
            this.events.emit("database/" + this.databaseId + "/index/" + _metric, newEntry);
            resolve("201");
        } catch (e){
          reject(e);
        }
*/
        fs.appendFile(
          this.basepath + _metric + "/" + this.indexname, stringify({
            "_tm": tm,
            "_data": data
          }) + "\n", (err) => {
            if (err) reject(err);
            fs.appendFile(newEntry, stringify({
              "_tm": _data.l3,
              "_data": _data
            }) + "\n", (err) => {
              if (err) reject(err);
              this.events.emit("database/" + this.databaseId + "/index/" + _metric, newEntry);
              resolve("201");
            });
          }
        );

      } else {
 /*
        try {
          fs.appendFileSync(newEntry, stringify({"_tm": _data.l3,"_data": _data }) + "\n");
          this.events.emit("database/" + this.databaseId + "/index/" + _metric, newEntry);
          resolve("201");
        } catch (e){
          reject(e);
        }
*/
        fs.appendFile(newEntry, stringify({
          "_tm": _data.l3,
          "_data": _data
        }) + "\n", (err) => {
          if (err) reject(err);
          this.events.emit("database/" + this.databaseId + "/index/" + _metric, newEntry);
          resolve("201");
        });

      }
    } else {
      resolve("200");
    }
  });
};

const readData = (_filename) => {
  let result = [];
  return new Promise((resolve, reject) => {
    try {
      if (fs.existsSync(_filename)) {
        fs.readFile(_filename, 'utf8', function(err, data) {
          if (!err) {
            if (data != null) {
              data.trim().split(/\n/).forEach(function(line) {
                if (line.trim() != "") {
                  try {
                    result.push(JSON.parse(line));
                  } catch (e) {}
                }
              });
              resolve(result);
            }
          }
        });
      } else {
        resolve(result);
      }
    } catch (e) {
      reject(e);
    }
  });
};

function stringify(obj){
  return JSON.stringify(obj);
}

// Interface
module.exports = timeObjectDB;