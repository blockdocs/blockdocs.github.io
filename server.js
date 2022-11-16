require('dotenv').config();

var express = require('express');
var app = express();
app.disable('x-powered-by');
var port = process.env.PORT || 3312;
var localOnly = process.argv[2] == '-local' || !!process.env.TEST;

// Todo:
// - Switch from fully local files to MongoDB
// - Account login system (popup), profile
// - Ask new questions (popup)
// - Ask follow up questions / remix questions (same popup?)
// - Get suggested followup options and act on them.


var http = require('http').Server(app);
var cors = require('cors');
var fs = require('fs');
var _ = require('lodash');
var util = require('./res/js/utilities.js');
for (var key in util) global[key] = util[key];

var noCache = function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "X-Requested-With");

  // No caching! Speed up loading on pinned to home
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate"); // HTTP 1.1.
  res.setHeader("Pragma", "no-cache"); // HTTP 1.0.
  res.setHeader("Expires", "0"); // Proxies.

  next();
};

var bodyParser = require('body-parser');
app.use(bodyParser.json()); // support json encoded bodies
app.use(bodyParser.urlencoded({ extended: true })); // support encoded bodies
app.use(require('cookie-parser')());
app.set('view engine', 'ejs');
app.use(cors());

// app.use('/res/css', express.static('./res/css')); // Fonts can't have no-cache or no-store to render in IE
app.use(noCache);
app.use('/', express.static('./'));


app.all('/', function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "X-Requested-With");

  // No caching! Speed up loading on pinned to home
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate"); // HTTP 1.1.
  res.setHeader("Pragma", "no-cache"); // HTTP 1.0.
  res.setHeader("Expires", "0"); // Proxies.

  next();
});

// var ready = function() {

//   app.get('/up', function(req, res) {
//     res.json('yes!');
//   });

//   app.get('/', noCache, function(req, res) {
//     res.render('home', {});
//   });

// };

http.listen(port, function() {
  console.log('listening on *:' + port);
  // ready();
});