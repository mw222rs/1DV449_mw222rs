var render = require('./lib/render');
var logger = require('koa-logger');
var route = require('koa-route');
var parse = require('co-body');
var koa = require('koa');
var rp = require('request-promise');
var session = require('koa-session');
var app = koa();

var scraper = require('./scraper/scraper');
var firstPageScraper = require('./scraper/firstPageScraper');
var calendarScraper = require('./scraper/calendarScraper');

app.keys = ['super secret stuff'];

app.use(logger());
app.use(session(app));

app.use(route.get('/', index));
app.use(route.get('/day/:id', day));
app.use(route.get('/choose-day', dayChooser));
app.use(route.get('/book/:id', book));
app.use(route.post('/', scrape));

function *index() {
    this.body = yield render('index', {title: 'Webbskraparn 1.0'});
}

function *scrape() {
    var post = yield parse(this);
    var prefix = 'http://';

    // If the posted url doesn't have the http:// in front, add it.
    post.url = post.url.substr(0, prefix.length) !== prefix ?
        prefix + post.url : post.url;
    // Remove any trailing slashes.
    post.url = post.url.replace(/\/+$/, '');

    // Get all links from first page and save to session cookie.
    this.session.urls = yield firstPageScraper(post.url);

    // Scrape calendar to find day(s) when the friends can meet.
    this.session.freeDays = yield calendarScraper(this.session.urls.calendar);

    // If more than one day is avalable...
    if (this.session.freeDays.length > 1) {
        // Let the user choose which...
        this.redirect('/choose-day');
    } else {
        // ... Else send directly to results.
        this.redirect(`/day/${this.session.freeDays[0].eng}`);
    }
}

function *dayChooser() {
    if (this.session.freeDays !== undefined) {
        this.body = yield render('dayChooser', {days: this.session.freeDays});
    } else {
        this.redirect('/');
    }
}

function *day(id) {
    var urls = this.session.urls;
    var dayToMeet = id;
    var scrapedData = yield scraper(urls, dayToMeet);

    this.body = yield render('results', {data: scrapedData});
}

function *book(id) {
    var url = `${this.session.urls.dinner}/login`;
    var username = 'zeke';
    var password = 'coys';
    var options = {
        method: 'POST',
        uri: url,
        form: {
            group1: id,
            username: username,
            password: password
        }
    };

    var postRequest = yield rp(options).then(res => res).
        catch(err => console.log(err));

    this.body = yield render('booked', {message: postRequest});
}

app.listen(3000);
