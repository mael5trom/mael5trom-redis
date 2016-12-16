var redis = require('redis');
var colors = require('colors');
var bluebird = require('bluebird');
bluebird.promisifyAll(redis.RedisClient.prototype);
bluebird.promisifyAll(redis.Multi.prototype);
function isEmptyObject(obj) {
    for (var key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            return false;
        }
    }
    return true;
}

function checkConfig (config){
    if (config == null ||  isEmptyObject(config)) {
        console.log(colors.red('Redis is missing critical configuration details in your .json file'));

        if (!config.url) {
            console.log(colors.red('Missing REDIS url, example configuration is {"namespace": {"redis":{"url":"this is your url to redis with usename and password"}'));
        }
        return false;
    }
    return true;
};
module.exports = function(app, config) {
    Redis.prototype = new app.Module({
        name: 'redis'
    }, app);
    var results = checkConfig(config);
        if(!results){
            app.Log.info('Loading REDIS Module for localhost because of missing configuration');
            var client = redis.createClient('redis://127.0.0.1:6379',{
                retry_strategy: function (options) {
                    if (options.error.code === 'ECONNREFUSED') {
                        // End reconnecting on a specific error and flush all commands with a individual error
                        return new Error('The server refused the connection');
                    }
                    if (options.total_retry_time > 1000 * 60 * 60) {
                        // End reconnecting after a specific timeout and flush all commands with a individual error
                        return new Error('Retry time exhausted');
                    }
                    if (options.times_connected > 10) {
                        // End reconnecting with built in error
                        return undefined;
                    }
                    // reconnect after
                    return Math.max(options.attempt * 100, 3000);
                }
            });

            return new Redis(app, client,{
                retry_strategy: function (options) {
                    if (options.error.code === 'ECONNREFUSED') {
                        // End reconnecting on a specific error and flush all commands with a individual error
                        return new Error('The server refused the connection');
                    }
                    if (options.total_retry_time > 1000 * 60 * 60) {
                        // End reconnecting after a specific timeout and flush all commands with a individual error
                        return new Error('Retry time exhausted');
                    }
                    if (options.times_connected > 10) {
                        // End reconnecting with built in error
                        return undefined;
                    }
                    // reconnect after
                    return Math.max(options.attempt * 100, 3000);
                }
            });
         }
        else if (results) {
            if (typeof config === 'boolean')
                config = null;
            var client = redis.createClient(config);
            if (typeof config.db_number !== 'undefined'){
                client.select(config.db_number);
            }
            return new Redis(app, client);
        }
};

function Redis(app, client) {
    for (var fn in client)
        if (typeof client[fn] === 'function' && ['on', 'emit'].indexOf(fn) === -1)
            this[fn] = client[fn].bind(client);

    client.on('error', function (err) {
        assert(err instanceof Error);
        assert(err instanceof redis.AbortError);
        assert(err instanceof redis.AggregateError);
        assert.strictEqual(err.errors.length, 2); // The set and get got aggregated in here
        assert.strictEqual(err.code, 'NR_CLOSED');
        app.Log.error('Redis:', err);
    });
    client.on('reconnecting', function(err){
        app.Log.error('Lost connection to REDIS server, attempting to reconnect...');
    });
    client.on('connect', function(err){
        app.Log.info('Connected to REDIS Server...');
    })

}