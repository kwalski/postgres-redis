// this test connects to actual servers

const { Pool, Client } = require('pg');



const Redis = require("redis");
const asyncRedis = require("async-redis"); 

const redisOptions = { host: "127.0.0.1", port: 6379 };
  
const pool = new Pool()
 
const redisConnection = Redis.createClient(redisOptions);


const redisConnectionAsync = asyncRedis.createClient(redisOptions);

const { PgRedis, PgRedisAsync, HashTypes } = require("./index");

const cacheOptions = {
    expire: 40, // seconds 
    keyPrefix: "sql.", // default
    hashType:HashTypes.blake2b512
};

const pgRedisAsync = new PgRedisAsync(
    pool,
    redisConnectionAsync,
    cacheOptions
);
const pgRedis = new PgRedis (
    pool,
    redisConnection,
    cacheOptions
);
  


const qAsync = async() => { 
    const {rows,fields}=await pgRedisAsync.query("select 1+$1",[1],{expire:100});
    
    console.log('qAsync:',rows,fields)
};
qAsync();
setTimeout(() => qAsync(), 100);
setTimeout(() => qAsync(), 200);
setTimeout(() => qAsync(), 300); 


const qSync =  () => {
    pgRedis.query('select 1+$1',[2],{expire:100},(err,{rows,fields})=>console.log('qSync:',err,rows,fields))
};
 
setTimeout(() => qSync(), 1100);
setTimeout(() => qSync(), 1200);
setTimeout(() => qSync(), 1300);
 


const qAsync2 = async() => { 
    const {rows,fields}=await pgRedisAsync.query( {text:"select 1+$1",values:[2]},{expire:100, hashType:HashTypes.farmhash64});
    
    console.log('qAsync2:',rows,fields)
};
 
setTimeout(() => qAsync2(), 2100);
setTimeout(() => qAsync2(), 2200);
setTimeout(() => qAsync2(), 2300); 


/***** Expected output **********
qAsync: [ { '?column?': 2 } ] [ Field {
    name: '?column?',
    tableID: 0,
    columnID: 0,
    dataTypeID: 23,
    dataTypeSize: 4,
    dataTypeModifier: -1,
    format: 'text' } ]
qAsync: [ { '?column?': 2 } ] [ { cacheHit:
     'sql.yipGPqNqcw8ueFQHOODc7EdHn3C/r8Ir1wj7JorxTIgI3mSawlddyi7cgUREU6XaqMzgaQ+LYwUGOW0oQ4CikA==' } ]
qAsync: [ { '?column?': 2 } ] [ { cacheHit:
     'sql.yipGPqNqcw8ueFQHOODc7EdHn3C/r8Ir1wj7JorxTIgI3mSawlddyi7cgUREU6XaqMzgaQ+LYwUGOW0oQ4CikA==' } ]
qAsync: [ { '?column?': 2 } ] [ { cacheHit:
     'sql.yipGPqNqcw8ueFQHOODc7EdHn3C/r8Ir1wj7JorxTIgI3mSawlddyi7cgUREU6XaqMzgaQ+LYwUGOW0oQ4CikA==' } ]
qSync: undefined [ { '?column?': 3 } ] [ Field {
    name: '?column?',
    tableID: 0,
    columnID: 0,
    dataTypeID: 23,
    dataTypeSize: 4,
    dataTypeModifier: -1,
    format: 'text' } ]
qSync: null [ { '?column?': 3 } ] [ { cacheHit:
     'sql.IHiyJimYSd0qPMqmSEeBiR1Fb8hup4pWaaOsISp3jQnlrwVyPjuuzto0f9CH1QRwD8V/leOYS8VQ3fvACKhabg==' } ]
qSync: null [ { '?column?': 3 } ] [ { cacheHit:
     'sql.IHiyJimYSd0qPMqmSEeBiR1Fb8hup4pWaaOsISp3jQnlrwVyPjuuzto0f9CH1QRwD8V/leOYS8VQ3fvACKhabg==' } ]
qAsync2: [ { '?column?': 3 } ] [ Field {
    name: '?column?',
    tableID: 0,
    columnID: 0,
    dataTypeID: 23,
    dataTypeSize: 4,
    dataTypeModifier: -1,
    format: 'text' } ]
qAsync2: [ { '?column?': 3 } ] [ { cacheHit: 'sql.2KnW38' } ]
qAsync2: [ { '?column?': 3 } ] [ { cacheHit: 'sql.2KnW38' } ]
*/
