/**
 * Module dependencies.
 */

var express = require('express'),
    http = require('http'),
    bodyParser = require('body-parser'),
    methodOverride = require('method-override'),
    errorHandler = require('error-handler'),
    routes = require('./routes'),
    redis = require('redis'),
    publisherClient = redis.createClient();

var app = module.exports = express();

// Configuration

// app.configure(function () {
    app.set('views', __dirname + '/views');
    app.set('view engine', 'pug');
    app.use(bodyParser.json());
    app.use(bodyParser.urlencoded({extended: true}));
    app.use(methodOverride());
    // app.get(app.router);
    app.use(express.static(__dirname + '/public'));
// });
app.use(errorHandler);
// var env = process.env.NODE_ENV || 'development';
// if ('development' == env) {
//     // app.use(errorHandler({dumpExceptions: true, showStack: true}));
// } else if ('production' == env) {
//     app.use(errorHandler);
// }


// Routes

app.get('/', function (req, res) {
    res.render('index');
});

app.get('/update-stream', function (req, res) {
    // let request last as long as possible
    req.socket.setTimeout(Number.MAX_VALUE);

    var messageCount = 0;
    var subscriber = redis.createClient();

    subscriber.subscribe("updates");

    // In case we encounter an error...print it out to the console
    subscriber.on("error", function (err) {
        console.log("Redis Error: " + err);
    });

    // When we receive a message from the redis connection
    subscriber.on("message", function (channel, message) {
        messageCount++; // Increment our message count

        res.write('id: ' + messageCount + '\n');
        res.write("data: " + message + '\n\n'); // Note the extra newline
    });

    //send headers for event-stream connection
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
    });
    res.write('\n');

    // The 'close' event is fired when a user closes their browser window.
    // In that situation we want to make sure our redis channel subscription
    // is properly shut down to prevent memory leaks...and incorrect subscriber
    // counts to the channel.
    req.on("close", function () {
        subscriber.unsubscribe();
        subscriber.quit();
    });
});

app.get('/fire-event/:event_name', function (req, res) {
    publisherClient.publish('updates', ('"' + req.params.event_name + '" page visited'));
    res.writeHead(200, {'Content-Type': 'text/html'});
    res.write('All clients have received "' + req.params.event_name + '"');
    res.end();
});

var server = http.createServer(app).listen(6379)
console.log("Express server listening on port %d in %s mode", server.address().port, app.settings.env);
