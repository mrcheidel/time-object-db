// Author: Claudio Heidel
const AVLTree = require('binary-search-tree').AVLTree  // https://github.com/mrcheidel/node-binary-search-tree
const fs = require('fs');
const path = require('path');

function timeObjectDB (options) {
  this.basepath = options.basepath;
  this.period = options.period;
  this.limit = options.limit;
  this.ext = ".dat";
}

timeObjectDB.prototype.getFirstLast = function (metric){
  var result = {"min":null, "max":null};
  return new Promise((resolve, reject) => {
      readData(this.basepath + metric + "/index.dat").then (data => {
        let mainIndex = new AVLTree();
        data.forEach(item => {
          mainIndex.insert(item._tm, item._data);
        });
       
        //main index
        let min = mainIndex.search(mainIndex.tree.getMinKey());
        let max = mainIndex.search(mainIndex.tree.getMaxKey());
        let ap = [];

        if (min.length == 0 || max.length == 0) resolve (result);

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
      }).catch (reason => {
        reject (reason);
      });
  });
}

timeObjectDB.prototype.getL1 = function (d){
  let yyyy = d.getFullYear();
  let mm = (d.getMonth() + 1).toString();
  if (mm.length < 2) mm = "0" + mm;
  return yyyy + "-" + mm;
}

timeObjectDB.prototype.getL2 = function (d){
  return d.toISOString().split('T')[0].split('-')[2];
  return d.toISOString().split('T')[0];
}

timeObjectDB.prototype.getL3 = function (epoc){
  var d = new Date(epoc * 1000);
  var f1a = parseInt(epoc / 86400) * 86400; //split by days
  var f1b = parseInt((epoc - f1a) / this.period) * this.period; //split each 5 minutes
  return (f1a + f1b);
}

timeObjectDB.prototype.read = function (metric,  fromEpoc, toEpoc){
  let result = {};
  let ap = [];

  return new Promise((resolve, reject) => {
    try {
      this.getIndexes(metric,  fromEpoc, toEpoc).then (data => {
        let bstIndex = new AVLTree();
        data.forEach(item => {
          if (item._tm && item._data){
            bstIndex.insert(item._tm, item._data);
          }
        });

        let fpa = bstIndex.betweenBounds({ $lte: this.getL3(toEpoc), $gte: this.getL3(fromEpoc)});

        fpa.forEach(fp => {ap.push(readData(fp.path + fp.file))});
        Promise.all(ap).then(values => {
          let tmp = [].concat.apply([], values);
          let bst = new AVLTree();
          tmp.forEach(item => {
            if (item._tm && item._data) {
                bst.insert(item._tm, item._data);
            }
          });
          result.data = bst.betweenBounds({ $lte: toEpoc, $gte: fromEpoc}).slice(0, this.limit);
          result.self = {};
          result.self.find = result.data.length;
          result.self.limit = this.limit;
          this.getFirstLast(metric).then (mm => {
            result.self.min = mm.min;
            result.self.max = mm.max;
            resolve (result);
          });
        }).catch(reason => {
          result.error = reason;
          reject (result);
        });
      }).catch (reason => {
        result.error = reason;
        reject (result);
      });
    } catch (e){
      result.error = e;
      reject (result);
    } 
  });
}

timeObjectDB.prototype.write = function (metric, tm, data) {
  return new Promise((resolve, reject) => {
    try {
      if (isNaN(tm)) reject ("500.1");  
      let fp = this.getPathFromEpoc(metric, tm);
      let _idata = {"_tm":tm, "_data":data};
      let _data = JSON.stringify(_idata) + "\n";
      let _file = fp.path + fp.file;

      if (!fs.existsSync(fp.path)) { fs.mkdirSync(fp.path, { recursive: true });}
      this.updateIndex(metric, _file, fp).then().catch( error => { reject (error);});

      fs.appendFile(_file, _data, (err) => {
        if (err) reject (err);  
        resolve ( "The file " + _file + " has been saved!");
      });
    } catch (e){
      reject (e);  
    }
  });
}

timeObjectDB.prototype.getPathFromEpoc = function  (metric, epoc) {
  let res = {"path":null, "file":null, "l1":null, "l2":null, "l3":null};
  try {
    if (isNaN(epoc)) return path;
    if (epoc > 253402300799) return path; // max 9990-12-31T23:59:59
    var d = new Date( epoc * 1000);

    var l1 = this.getL1(d);
    var l2 = this.getL2(d);
    var l3 = this.getL3(epoc);

    res.path =  this.basepath + metric + "/" + l1 + "/" + l2 + "/";
    res.file = l3 + this.ext;
    res.l1 = l1;
    res.l2 = l2;
    res.l3 = l3;

  } catch (e){
    console.log (e);
  } finally {
    return res;
  }
}

timeObjectDB.prototype.checkIndex = function (_BRecreate){
  //TODO
  // Verify if the index is aligned and Recreate it if is necesary
}

timeObjectDB.prototype.reset = function (_metric){
  const fs2 = require('fs-extra');
  fs2.removeSync(this.basepath + "/" + _metric);
}

timeObjectDB.prototype.getIndexes = function (_metric,  fromEpoc, toEpoc) {
  return new Promise((resolve, reject) => {
    var ap = [];
    var frDate = new Date(fromEpoc * 1000);
    var toDate = new Date(toEpoc * 1000);
    while (this.getL1(frDate) <= this.getL1(toDate)) {
      ap.push (readData(this.basepath + _metric + "/" + this.getL1(frDate) + "/index.dat"));
      frDate = new Date(frDate.setMonth(frDate.getMonth() + 1));
    }

    Promise.all(ap).then(values => {
      let result = [].concat.apply([], values);
      resolve (result);
    }).catch(reason => {
      console.log (reason);
      reject ([]);
    });
  });
};

timeObjectDB.prototype.updateIndex = function (_metric, _file, _data) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(_file)) {
      let newEntry = this.basepath + _metric + "/" + _data.l1 + "/index.dat";
      if (!fs.existsSync(newEntry)) {
        let tm = parseInt(new Date(_data.l1 + '-01').getTime()/1000);
        let data = {"index": newEntry};
        fs.appendFile(
          this.basepath + _metric + "/index.dat",
          JSON.stringify({"_tm":tm, "_data":data}) + "\n",
          (err) => {
            if (err) reject (err);
            fs.appendFile(newEntry, JSON.stringify({"_tm":_data.l3, "_data":_data}) + "\n", (err) => {
              if (err) reject (err);
              resolve("The file " + this.basepath + _metric + "/index.dat" + " has been updated!");
            });
          }
        );
      } else {
        fs.appendFile(newEntry, JSON.stringify({"_tm":_data.l3, "_data":_data}) + "\n", (err) => {
          if (err) reject (err);
          resolve("The file " + this.basepath + _metric + "/index.dat" + " has been updated!");
        });
      }
    } else {
      resolve("Index exist");
  }
/*
      fs.appendFile(newEntry, JSON.stringify({"_tm":_data.l3, "_data":_data}) + "\n", (err) => {
        if (err) reject (err);

        let tm = parseInt(new Date(_data.l1 + '-01').getTime()/1000);
        let data = {"index": this.basepath + _metric + "/" + _data.l1 + "/index.dat"};
        fs.appendFile(this.basepath + _metric + "/index.dat", JSON.stringify({"_tm":tm, "_data":data}) + "\n", (err) => {
          if (err) reject (err);
          resolve("The file " + this.basepath + _metric + "/index.dat" + " has been updated!");
        });
      });
*/

  });
};

const readData = (_filename) => {
  let result = [];
  return new Promise((resolve, reject) => {
      try {
        if (fs.existsSync(_filename)) {
          fs.readFile(_filename, 'utf8', function (err, data) { 
            if (!err){
              if (data!=null){
                data.trim().split(/\n/).forEach(function(line) {
                  if (line.trim()!=""){
                    try {result.push (JSON.parse(line));} catch (e) {}
                  }
                });
                resolve(result);
              }
            }
          });
        } else {
          resolve(result);
        }
      } catch (e){
        reject(e);
      }
  });
};

// Interface
module.exports = timeObjectDB;