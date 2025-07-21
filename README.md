

# Prerequisite
```
brew install postgresql
brew install cassandra
brew install nvm
nvm install 20
```
## verify if node and npm are installed after nvm install 20
```
node -v
npm -v
```

# How to start

## start the docker-compose

It will start postgres, rabbitMQ, api server, websocket server in docker, and start the frontend server out side docker
```
bash start.sh
```
We need to wait around 1 minute for the cassandra instance to be fully started after the docker is started. After that, there will be an init sql ran, for creating a table to store the operation logs for real time collaboration.


## Start the api server outside docker
1. `cd servers`
2. `nvm use 20`  (use node version 20)
3. `npm install`
4. rename ".env.example" tp ".env"
5. `APP=api npm run start:dev`
6. you may need to change the port number if there is an api server ran inside docker

## Start the websocket server outside docker
1. `cd servers`
2. `nvm use 20`  (use node version 20)
3. `npm install`
4. rename ".env.example" tp ".env"
5. `APP=websocket npm run start:dev`
6. you may need to change the port number if there is an api server ran inside docker

## Start frontend
1. `cd ./frontend`
2. `nvm use 20`  (use node version 20)
3. `npm install`
4. `PORT=5001 npm start`

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
- "Bearer" prefix is not need when you input the JWT token in swagger. It is handled behind the scene

### api usage:
- `/POST /user` create a user
- `/POST /auth/login` get the jwt token
- `/POST /todo` create a new todo, user uuid is parsed from jwt token, by default the user-todo role is OWNER
- `/PATCH /todo/{uuid}` update a todo by todo uuid
- `/GET /todo{uuid}` get a todo by todo uuid
- `/DELETE /todo/{uuid}` solf delete a todo
- `/POST /todo/{uuid}/invite invite` another user to the todo
- `/PATCH /todo/{uuid}/role` update another user's role of a todo
- `/GET /todo{uuid}/user-role` get the user role of a todo, user uuid is parsed from jwt token
- `/DELETE /todo/{uuid}/user-permission` remove user from a todo
- `/GET /todos` get a list of tods with filter, sorting, and pagaination


## Miscellaneous
- For simplicity, automigrate by ORM is enabled, however, in a real production app, it is not preferable
```
synchronize: true
```