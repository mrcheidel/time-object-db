const get = require("axios").get;
const post = require("axios").post;
const del = require("axios").delete;

const coherseCallback = (axiosPromise, callback) => {
  let p = new Promise((resolve, reject) => {
    axiosPromise
      .then(response => {
        let { data } = response;
        if (callback) {
          callback(null, data);
          return;
        }
        resolve(data);
      })
      .catch(err => {
        if (callback) {
          callback(err);
          return;
        }
        reject(err);
      });
  });
  return p;
};

const todbclient = config => {
  let { databaseId, token, url } = config;
  if (!url) url = 'https://time-object-db.claudioheidel.repl.co/v1';

  return {
    createDb: (cb) => {
      return coherseCallback(
        post(
          url + '/databases',
          {},
          {}
        ),
        cb
      );
    },

    checkHealth:(cb) => {
      return coherseCallback(
        get(
          url + '/health',
          {},
          {}
        ),
        cb
      );
    }, 

    insertObject: (metricId, tm, object, cb) => {
      return coherseCallback(
        post(
          url + '/databases/' + databaseId + '/metrics/' + metricId +'/objects',
          {tm:tm, data:object},
          {
            headers: {
              token,
              'X-Action': 'single'
            }
          }
        ),
        cb
      );
    },

    insertBulkObjects: (metricId, objArray, cb) => {
      return coherseCallback(
        post(
          url + '/databases/' + databaseId + '/metrics/' + metricId +'/objects',
          {tm:0, data:objArray},
          {
            headers: {
              token,
              'X-Action': 'bulk'
            }
          }
        ),
        cb
      );
    },


    findObjects: (metricId, fr, to, cb) => {
      return coherseCallback(
        get(
          url + '/databases/' + databaseId + '/metrics/' + metricId +'/objects',
          {
            params: {
              fr: fr,
              to:to
            },
            headers: {
              token
            }
          }
        ),
        cb
      );
    },

    deleteObject: (metricId, tm, cb) => {
      return coherseCallback(
        del(
          url + '/databases/' + databaseId + '/metrics/' + metricId +'/objects/' + tm,
          {
            headers: {
              token
            }
          }
        ),
        cb
      );
    },

    deleteMetric: (metricId, cb) => {
      return coherseCallback(
        del(
          url + '/databases/' + databaseId + '/metrics/' + metricId,
          {
            headers: {
              token
            }
          }
        ),
        cb
      );
    },

    deleteDb: (cb) => {
      return coherseCallback(
        del(
          url + '/databases/' + databaseId,
          {
            headers: {
              token
            }
          }
        ),
        cb
      );
    }
  };
};

module.exports = todbclient;