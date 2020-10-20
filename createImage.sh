docker stop time-object-db-instance
docker rm time-object-db-instance
docker rmi time-object-db
docker build -t time-object-db .
mkdir -p $(pwd)/data-volume
docker run -d --name time-object-db-instance -h time-object-db-instance -v $(pwd)/data-volume:/app/data -p 8000:8000 -t time-object-db


#https://ropenscilabs.github.io/r-docker-tutorial/04-Dockerhub.html

#find de dockerId and tag with it...

#docker tag 99f4d100d0a4 mrcheidel/time-object-db:latest

#docker push mrcheidel/time-object-db:latest

