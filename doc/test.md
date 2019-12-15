test


ab -n 10000 -c 100 -k -l http://localhost:8000/v1/health

ab -n 10000 -c 100 -k -l http://localhost:8003/v1/health



ab -n 10000 -c 100 -k -l -H "accept: application/json" -H "token: 693299a20f9335567719e4441108bb1e77526af7cc63f18c66f7785c6c507f97" "http://localhost:8000/v1/databases/2d17c0cf-447c-4847-b3e8-d0c2f0ce332a/metrics/test/objects?fr=0&to=1300" 

 
 
 https://github.com/dtjohnson/proxy-benchmark/tree/master/proxies
 https://github.com/http-party/node-http-proxy/issues/1058
 https://strongloop.com/strongblog/node-js-performance-scaling-proxies-clusters/
 
 

 curl -X POST "http://localhost:8000/v1/databases" -H "accept: application/json"
 
"2d17c0cf-447c-4847-b3e8-d0c2f0ce332a"
"693299a20f9335567719e4441108bb1e77526af7cc63f18c66f7785c6c507f97"

curl -X POST "http://localhost:8000/v1/databases/2d17c0cf-447c-4847-b3e8-d0c2f0ce332a/metrics/test/objects" -H "accept: application/json" -H "token: 693299a20f9335567719e4441108bb1e77526af7cc63f18c66f7785c6c507f97" -H "X-Action: single" -H "Content-Type: application/json" -d "{\"tm\":1234,\"data\":{\"name\":\"Claudio\"}}"

curl -X GET "http://localhost:8000/v1/databases/2d17c0cf-447c-4847-b3e8-d0c2f0ce332a/metrics/test/objects?fr=0&to=1300" -H "accept: application/json" -H "token: 693299a20f9335567719e4441108bb1e77526af7cc63f18c66f7785c6c507f97"