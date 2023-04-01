# Running the Redis CLI and Flyctl container

Build the Docker image by running the following command:

    docker build -t redis-cli-flyctl .

This command will build the Docker image and tag it with the name redis-cli-flyctl.

Once the build process completes successfully, you can start a container by running the following command:

    docker run -d -p 6379:6379 redis-cli-flyctl

This command will start a new container and drop you into a bash shell. From here, you can run the Redis CLI or Flyctl as needed.

Put `FLYIO_REDIS_URL="redis://localhost:6379"` in yout .env file so the express server uses it instead

That's it! You should now have a Docker container with Redis CLI and Flyctl installed and ready to use.

You can open the Docker Terminal run `redis-cli` & follow up with redis commands to interact with the cache

    KEYS *

Will list all keys on the cache

    GET mykey

Will retrieve the time to live for mykey

    TTL mykey

Will retrieve the cached value for mykey

    DEL mykey

Will remove the cache key

    FLUSHDB

Will remove ALL cache keys

You can also use redis-cli to connect to flyio redis upstash instance

    flyctl redis connect

## Gotchas

- When running `npm run fly:deploy` the contents of .env are used. Therefore, if you set up local redis, the redis connection will fail when deployed.
