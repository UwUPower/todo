docker-compose up --build -d
echo "waiting cassandra started..."
sleep 60
docker cp ./cassandra-init/init.cql cassandra_db:/init.cql
docker exec cassandra_db cqlsh -u cassandra -p cassandra cassandra_db 9042 -f /init.cql