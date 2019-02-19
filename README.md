

# pg-redis :rocket:

Transform your postgres server with `Redis` caching layer for `pg`.
- PgRedis checks if there is a cached result for the query in redis 
- if not found in cache, it will retrieve data from postgres and on successful result cache it in redis for future queries
- if redis is unavailable or errors, query will be served by postgres

## Use-case
Use _along_ with postgres and redis. This is not a replacement of either. Use it with queries/stored procedures that only perform `select` and will return same result set everytime.

- **No brainer** for retrieving static data, eg, `select * from countries`
- Data that will not be updated once created, typically time series data like chat messages, logs
- Use with caution where data may get updated in postgres as redis cache may be stale

### Hashing 
 The above is achieved by creating a unique hash for every query
 
    "select 1+2" => #️⃣
  
In redis, the hash and query results are stored as key-value pair

    #️⃣ => [{'1+2':3}]

#### Currently supported hash types are:    
  
**farmhash32** ⚡🗜️
Example redis key: *prefix.*`2jNDCJ`
Fast!!! Over ~5 million hashes/s on reference machine. Most compact key.

**farmhash64** 
Example redis key:  *prefix.*`DiHlF3yv0V$` 
fast (~2 million hashes/sec on reference machine )
*farmhash32/64* use Google's farmhash, non-crypto algorithm (if you have millions of possible queries, these hashes can collide :collision:) so use it for hundreds or thousands of static queries

**blake2b512** 🛡️
Example redis key: *prefix.*`4KbMOx3xJi+7mJNy0tDbju6NY9uHqOroDsG4rYjpHK1mEwXJokls5Ofdjs7iDsn3cAtibgUkT8RDdpCE2phhiQ==` 
Crypto safe, ~500k hashes/sec on reference machine
Use it for caching millions of different queries (eg. chats, logs)
Note that the key is longer than farmhash.

**full** 
Matches full query string. Use this if you are paranoid or if your queries are smaller than blake2b512 hashes

Or you can **provide your own hash *per* query**, eg, *prefix.*`p.123` to represent `select * from person p where id = $1,[123]` 

## Getting Started

### Pre-Requisites
postgres ([pg](https://www.npmjs.com/package/pg)/[pg-pool](https://www.npmjs.com/package/pg-pool)), and redis ([redis](https://www.npmjs.com/package/redis)/[ioredis](https://www.npmjs.com/package/ioredis)). Internally PgRedis relies on pg/pg-pool's `query` function and redis's `get` and `set` functions

For async/await api, you can use pg/pg-pool's promise api and [redis-async](https://www.npmjs.com/package/pg-redis)

### Installing
`npm i pg-redis --save` 

### Usage
```
const { PgRedis, HashTypes } = require("pg-redis");

// or if you use async await api
const { PgRedisAsync, HashTypes } = require("pg-redis");
```

####  Creating an instance of PgRedis requires 
- a pg connection or pg-pool (PgRedis will call it's query method when no cache found)
- redis connection (PgRedis will call its set and get methods)
- cache options (optional)  

####  Creating an instance of PgRedisAsync requires 
- a pg connection or pool promise 
- async redis
	```
	eg:
	const  asyncRedis  =  require("async-redis");
	const  redis  =  asyncRedis.createClient(redisOptions);

	```
- cache options (optional)  

```
const cacheOptions = {
    expiry: 2629746,// seconds, defaults to 30 days 
    keyPrefix: "sql.", // default
    hashType: HashTypes.farmhash32 //default
};

const pgRedis = new PgRedis(
    pgConnection,
    redisConnection,
    cacheOptions
);
```
Now if you wish to get something from cache, just use pgRedis.query instead of your pg connection's query. **Use your pg/pg-pool normally to bypass cache**
```
// query can be string 
// or object { text:'select 1 + $1', values:[2] }
pgRedis.query('select * from logs where id =$1",["some-log-id"], ( err, { rows, fields } )=>{
	console.log(rows)
	// if served by Redis, fields value is something like [ { cacheHit: 'sql.Dh9VSNbN5V$' } ]
	// else pg fields
});
```

or if you like promises, then:

```
const pgRedis = new PgRedisAsync(
    pgConnection,
    redisConnection,
    cacheOptions
);

... in an async function ...
try{

	const { rows, fields }=await pgRedis.query("select 1+$1+$2",[2,3]);

}catch(err){
	// handle err
}

```
You can override cache options per query as below:

```
pgRedis.query('select * from logs where id =$1",["some-log-id"],
	{ //cache option
		keyPrefix:'sql-abc-', 
		expire:3600, 
		hashType: HashTypes.farmhash64 
        //or hash: myHash <- provide your own 
	}, 
	( err, { rows, fields } )=>{
	console.log(rows)
	// if served by Redis, fields value is something like [ { cacheHit: 'sql.Dh9VSNbN5V$' } ]
	// else pg fields
});


// promise api
const { rows, fields }=await pgRedis.query("select 1+$1+$2",[2,3],
   { //cache option
		keyPrefix:'sql-abc-', 
		expire:3600, 
		hashType: HashTypes.farmhash64 
        //or hash: myHash <- provide your own 
	});

```

 
## Contributing

 Feel free to fork/send PR

## Authors

* **Gi Singh** 

## License

This project is licensed under the [MIT](./LICENSE).
