# JustWatch Done Right

A web which allows to search for movie streaming providers powered by JustWatch that also integrates with Letterboxd, minus the headache of sifting through annoying, irrelevant recommendations - meaning no movie suggestions whatsoever... with a little plus 🏴‍☠️

## Run locally / debugging

PRE: You need to have docker to run the image at /redis folder

- Rename .env.example to .env & update the values
- Run `npm run dev`

## Troubleshotting

- Read `redis/README.md`

## Gotchas

- When running `npm run fly:deploy` the contents of .env are used. Therefore, if you set up local redis, the connection will fail when deployed.

## First time deployment

- Replace "name" & "app" strings with your new app name at package.json at fly.toml (respectively) 
- Run `npm i`
- Rename .env.example to .env
- Run `flyctl launch`
- When prompted for a builder, select builtin Nodejs.
- Run `npm run fly:deploy` (for future deployments only this command will be needed)

## Stopping app (without deleting)

- `npm run fly:stop`

## Starting back again

- `npm run fly:start`

## Read secrets

- `npm run fly:ssh`
- type `env`
- quit with `exit`

## Set secrets

Add them to .env file. Alternatively use fly.io built command but note those take precedence over the ones at .env

- `flyctl secrets set SECRET="myvalue" -a <app-name>`

## Read server logs from terminal

- `npm run fly:logs`

## Redis

Upstash Redis created with `flyctl redis create`

- `flyctl redis list` & copy redis name
- `flyctl redis status <redis-name>` & then copy the Private URL & set the proper env variable at the .env file
