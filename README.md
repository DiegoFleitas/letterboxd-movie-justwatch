# justwatch-done-right

A streaming movie search platform, powered by Justwatch and integrated with Letterboxd, designed to avoid the frustration of irrelevant recommendations (By ditching the movie recommendation feature altogether lol)

## Run locally / debugging

- Rename .env.example to .env & update the values
- Run `npm run start`

## First time deploying

- Replace "name" & "app" strings at package.json at fly.toml (respectively) with your new app name
- Run `npm i`
- Rename .env.example to .env
- Run `flyctl launch`
- When prompted for a builder, select builtin Nodejs.
- Run `npm run fly:deploy` (for following deploys only this command is needed)

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
