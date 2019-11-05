# time-object-db

Welcome to timeObjectsDB

Objective:

Develop an file based DB in order to store any Objects type correlated to the epoc date time.
The main features of this DB are:
- Store Objects into metrics.
- Fetch metrics Objects from a windows time (betweeen fromEpoc and toEpoc)
- Delete Objects from an specific metric.

Solution:
  I use single files splited in tree levels:
  Level 1: YYYY-MM
  Level 2: DD
  Level 3: One file each 5 minutes (configurable)
  

API Contract: https://editor.swagger.io/?url=https://time-object-db.claudioheidel.repl.co/contract

Online Demo: https://time-object-db.claudioheidel.repl.co

Author: Claudio Heidel Schemberger - https://www.linkedin.com/in/mrcheidel/


