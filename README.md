---
title: Time Object Database
author: Claudio Heidel Schemberger
---
<link rel="stylesheet" type="text/css" media="all" href="doc/style.css" />

# Welcome to time-object-db 

Current version: 1.0.4

## Challenge:

The challenge was to create a persistence system to store objects correlated with the date-time for later use without the need to install and maintain an exclusive service (external databases).

This persistence system need to have a quickly search feature, for this reason we use binary tree and cascading indexes.

At the same time this solution should be easy to deploy in cloud services such as the AWS Lambda functions (high availability and auto scaling).

The main features of the time-object-db are:
- Create metrics collections and store objects.
- Fetch metric objects from a period time (between fromEpoc and toEpoc).
- Delete metric objects from a specific time value.
- Complete clean a metric collection

This database emit 5 events

- insert => When a new object is inserted
- delete => When a object has been deleted
- index => When a index is updated or created
- clear => When a metric is deleted
- read => When a new query has been executed.


### Development notes:

time-object-db is developed using only **[node.js](https://nodejs.org/)**

I'm developing this project in my free time from different places. For this reason, I use **[Repl.it](https://repl.it/)**, an online coding platform that allows me continue working regardless where I'm.

### How to install


```bash
mkdir test-folder
cd test-folder
git clone https://github.com/mrcheidel/time-object-db.git
cd time-object-db
npm install
node index.js
```


### How to use - API Contract: 

This database may be used directly from your own node.js code or via RESTful API calls.

[View & Execute the API contract](https://editor.swagger.io/?url=https://time-object-db.claudioheidel.repl.co/contract)

![](doc/titulo.png)

### Postman Collection

You could be use the [Postman tool](https://www.getpostman.com/) in order to test this API.

Find the [Postman collection and examples](https://github.com/mrcheidel/time-object-db/tree/master/test) that you could be import into the postman.


![](doc/post-example.png)

![](doc/get-example.PNG)

![](doc/delete-example.PNG)


## Solution:

time-object-db use single files in order to persist the information splitted in three levels:

- Level 1: YYYY-MM (Max 12 folders per year)
- Level 2: DD (Max 365 folders per parent)
- Level 3: One file each 5 minutes - (Max 144 files per parent) (configurable) 

Exist an index file per each Level 1 and 2 folders, these indexes help to find existing Level 3 files and prevent to use a full-scan to find the existing files.
  
## Todo

List of pending points

- Implement the **checkIndex** like a health functionality with re-creation index option.

## Real time examples

Online Demo: [Repl](https://time-object-db.claudioheidel.repl.co)

Source Code: [Github]( https://github.com/mrcheidel/time-object-db)

Author: Claudio Heidel Schemberger - [Linkedin](https://www.linkedin.com/in/mrcheidel/)

