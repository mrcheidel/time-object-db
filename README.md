---
title: Time Object Database
author: Claudio Heidel Schemberger
---
<link rel="stylesheet" type="text/css" media="all" href="doc/style.css" />

# Welcome to time-object-db

## Objective:

Develop a file based database in order to store any object type correlated to the epoc date time.
The main features of the time-object-db are:
- Store Objects into metrics.
- Fetch metrics Objects from a windows time (betweeen fromEpoc and toEpoc)
- Delete Objects from an specific metric.

### How to use - API Contract: 

This database may be used directly from node.js or via RESTful API calls.

[View & Execute the API contract](https://editor.swagger.io/?url=https://time-object-db.claudioheidel.repl.co/contract)

![](doc/api-screen-shot-1.PNG)

### Postman Collection

You could be use the [Postman tool](https://www.getpostman.com/) in order to test this API.

Find the [Postman collection and examples](https://github.com/mrcheidel/time-object-db/tree/master/test) that you could be import into the postman.


![](doc/post-example.png)

![](doc/get-example.PNG)

![](doc/delete-example.PNG)


## Solution:

timeObjectsDB use single files in order to persist the information splited in three levels:

- Level 1: YYYY-MM (Max 12 folders per year)
- Level 2: DD (Max 365 folders per parent)
- Level 3: One file each 5 minutes - (Max 144 files per parent) (configurable) 

Exist an index file per each Level 2 folder, this index help to find existing Level 3 files and prevent to use a full-scan to find the existing files.
  
## Real time examples

Online Demo: [Repl](https://time-object-db.claudioheidel.repl.co)

Source Code: [Github]( https://github.com/mrcheidel/time-object-db)

Author: Claudio Heidel Schemberger - [Linkedin](https://www.linkedin.com/in/mrcheidel/)


