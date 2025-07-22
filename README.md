## Framework and language
In my tech stack, TypeScript with Nestjs is the closest to C# ASP.NET
- Strong type language
- Built-in dependency injection
- Built-in MVC pattern
- DTO with data anotations

https://docs.nestjs.com/

## Architectural diagram
<img width="1266" height="659" alt="Screenshot 2025-07-22 at 00 44 51" src="https://github.com/user-attachments/assets/44e213df-88e3-4c9c-a67e-ba235b21f1e6" />

The architecture is almost the same as "Operational Transform" section in the design document, except the following points:
- servers and databases are deployed in docker rather than cloud
- RabbitMQ is used instead of AWS eventbridge
- No Nginx is implemented
- The operational transform logic in frontend is only for indicative purpose, not production ready.

## Prerequisite
```
brew install postgresql
brew install cassandra
brew install nvm
nvm install 20
```
### verify if node and npm are installed after nvm install 20
```
node -v
npm -v
```

## How to start

### start the docker-compose

It will start postgres, rabbitMQ, api server, websocket server in docker, and start the frontend server out side docker
```
bash start.sh
```
We need to wait around 1 minute for the cassandra instance to be fully started after the docker is started. After that, there will be an init sql ran, for creating a table to store the operation logs for real time collaboration.


### Start the api server outside docker
1. `cd servers`
2. `nvm use 20`  (use node version 20)
3. `npm install`
4. rename ".env.example" tp ".env"
5. `APP=api npm run start:dev`
6. you may need to change the port number if there is an api server ran inside docker

### Start the websocket server outside docker
1. `cd servers`
2. `nvm use 20`  (use node version 20)
3. `npm install`
4. rename ".env.example" tp ".env"
5. `APP=websocket npm run start:dev`
6. you may need to change the port number if there is an api server ran inside docker

### Start frontend
1. `cd ./frontend`
2. `nvm use 20`  (use node version 20)
3. `npm install`
4. `PORT=5001 npm start`

### access the postgres databse
```
PGPASSWORD=password psql -h localhost -p 5432 -U user todo
```

### access the casandra database
```
cqlsh -u cassandra -p cassandra localhost 9042
```

### access rabbitMQ

open it in a web browser, username: guest, password: guest
```
http://localhost:15672/
```

### Run tests

#### run unit test
```
cd server
npm install
npm run test
```

#### run unit test with coverage report
```
cd server
npm install
npm run test:cov
```

#### run integration tests
start the database and api server first
```
pip install request
python integration_test.py

```

### Swagger docs
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


### Potential refactoring list

- For simplicity, automigrate by ORM is enabled, however, in a real production app, db migration should be done with seperate `up.sql` and `down.sql`. We should also keep track the database migration version.

https://github.com/UwUPower/todo/blob/d9aa05a98f626055c75f4e01156529ebfc7bec86/servers/src/api.app.module.ts#L26-L27

- Database actions for creating todo and setting default role should be wrapped in a transaction:
https://github.com/UwUPower/todo/blob/80f904a26c97f6d530af4203c27ca04a3c19fc1c/servers/src/todo/todo.service.ts#L51-L58

- Perhaps we want to have a new service called `TodoPermissionService` for hosting business logic related to user permision on a todo (worth to discuss)

https://github.com/UwUPower/todo/blob/80f904a26c97f6d530af4203c27ca04a3c19fc1c/servers/src/todo/todo.service.ts#L318-L427

- The connection of cassandra and rabbitMQ should be wrapped in injectable module, instead of initialized directly in service level

https://github.com/UwUPower/todo/blob/80f904a26c97f6d530af4203c27ca04a3c19fc1c/servers/src/todo-post-edit-consumer/todo-post-edit-consumer.service.ts#L62-L106
