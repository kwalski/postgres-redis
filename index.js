const farmhash = require("farmhash");
const { String64 } = require("string64");
const str64 = new String64();
const crypto = require("crypto");

const HashTypes = {
    farmhash32: 0,
    farmhash64: 1,
    blake2b512: 2,
    full: 3
};

Object.freeze(HashTypes);

const defaultCacheOptions = {
    expire: 2629746,
    keyPrefix: "sql.",
    hashType: HashTypes.farmhash32
};

const hash = (sql, hashType) => {
    switch (hashType) {
           
        case HashTypes.blake2b512:
            return crypto
                .createHash("blake2b512")
                .update(sql)
                .digest("base64");
            break;

        case HashTypes.full:
             return sql;
            break;
        case HashTypes.farmhash64:
            return str64.toString64(
                Number.parseInt(farmhash.fingerprint32(sql))
            );
            break;
        case HashTypes.farmhash32:
        default:
            return str64.toString64(
                Number.parseInt(farmhash.fingerprint64(sql))
            );
    }
};

class PostgresRedis {
    constructor(pgConn, redisClient, cacheOptions) {        
        this.pgConn = pgConn;
        this.redisClient = redisClient;
        this.cacheOptions = {
            expire:
                (cacheOptions && cacheOptions.expire) ||
                defaultCacheOptions.expire,
            keyPrefix:
                (cacheOptions && cacheOptions.keyPrefix) ||
                defaultCacheOptions.keyPrefix,
            hashType:
                (cacheOptions && cacheOptions.hashType) ||
                defaultCacheOptions.hashType
        };
    }

    query(sql, values, options, cb) {
        options = options || (!Array.isArray(values) ? values : null);
        cb = cb || options || values; //in case expire is not provided, cb is third arg

        const s = typeof sql === "string" ? sql : sql.text;
        const v =
            typeof sql === "string"
                ? Array.isArray(values)
                    ? values
                    : ""
                : sql.values && Array.isArray(sql.values)
                    ? sql.values
                    : "";
        const _s = s + JSON.stringify(v);
        const prefix =
            (options && options.keyPrefix) || this.cacheOptions.keyPrefix;

        const hashType =
            (options && options.hashType) || this.cacheOptions.hashType;

        const key = prefix + ((options && options.hash) || hash(_s, hashType));

        this.redisClient.get(key, (redisErr, redisResult) => {
            if (redisErr || redisResult == null) {
                this.pgConn.query(
                    sql,
                    Array.isArray(v) ? v : [],
                    (pgErr, { rows, fields }) => {
                        if (pgErr) {
                            return cb(pgErr, null);
                        } else {
                            if (!redisErr) {
                                this.redisClient.set(
                                    key,
                                    JSON.stringify(rows),
                                    "EX",
                                    (options && options.expire) ||
                                        this.cacheOptions.expire,
                                    (err, res) => {}
                                );
                            }
                            return cb(pgErr, { rows, fields });
                        }
                    }
                );
            } else {
                return cb(null, {
                    rows: JSON.parse(redisResult),
                    fields: [{ cacheHit: key }]
                });
            }
        });
    }
}

// PROMISE API

class PostgresRedisAsync {
    constructor(pgConn, redisClient, cacheOptions) {
        this.pgConn = pgConn;
        this.redisClient = redisClient;
        this.cacheOptions = {
            expire:
                (cacheOptions && cacheOptions.expire) ||
                defaultCacheOptions.expire,
            keyPrefix:
                (cacheOptions && cacheOptions.keyPrefix) ||
                defaultCacheOptions.keyPrefix,
            hashType:
                (cacheOptions && cacheOptions.hashType) ||
                defaultCacheOptions.hashType
        };
    }

    query(sql, values, options) {
        // cb = cb || options || values; //in case expire is not provided, cb is third arg

        return new Promise(async (resolve, reject) => {
            options = options || (!Array.isArray(values) ? values : null);

            const s = typeof sql === "string" ? sql : sql.text;
            const v = typeof sql === "string"
                ? Array.isArray(values)
                    ? values
                    : ""
                : sql.values && Array.isArray(sql.values)
                    ? sql.values
                    : "";
        const _s = s + JSON.stringify(v);
            const prefix =
                (options && options.keyPrefix) || this.cacheOptions.keyPrefix;

            const hashType =
                (options && options.hashType) || this.cacheOptions.hashType;

            const key =
                prefix + ((options && options.hash) || hash(_s, hashType));
            try {
                const redisResult = await this.redisClient.get(key);

                if (redisResult) {
                    resolve({
                        rows: JSON.parse(redisResult),
                        fields: [{ cacheHit: key }]
                    });
                } else {
                    try {
                        const { rows, fields } = await this.pgConn.query(
                            sql,
                            Array.isArray(v) ? v : []
                        );
                        await this.redisClient.set(
                            key,
                            JSON.stringify(rows),
                            "EX",
                            (options && options.expire) ||
                                this.cacheOptions.expire
                        );
                        resolve({ rows, fields });
                    } catch (pgErr) {
                        reject(pgErr);
                    }
                }
            } catch (redisErr) {
                try {
                    const { rows, fields } = await this.pgConn.query(
                        sql,
                        Array.isArray(values) ? values : []
                    );
                    resolve({ rows, fields });
                } catch (pgErr) {
                    reject(pgErr);
                }
            }
        });
    }
}

module.exports = { PostgresRedis, PostgresRedisAsync, HashTypes };
