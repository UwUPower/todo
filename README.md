# Prerequisite
```
brew install postgresql
brew install cassandra
```

# How to start

## start the docker-compose

It will starts everything, including databases, app servers and rabbitMQ
```
bash start.sh
```

## If you want start the api server outside docker
1. rename ".env.example" tp ".env"
2. npm run start:dev
3. you may need to change the port number if there is an api server ran inside docker

## access the postgres databse
```
PGPASSWORD=password psql -h localhost -p 5432 -U user todo
```

## access the casandra database
```
cqlsh -u cassandra -p cassandra localhost 9042
```

## access rabbitMQ

open it in a web browser, username: guest, password: guest
```
http://localhost:15672/
```


```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Run tests

### run test
```bash
npm run test
```

### run test with coverage report
```bash
npm run test:cov
```

## Swagger docs
```
http://localhost:3000/api-docs
```

## Miscellaneous
- For simplicity, automigrate by ORM is enabled, however, in a real production app, it is not preferable
```
synchronize: true
```