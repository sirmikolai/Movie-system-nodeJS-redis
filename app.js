var express = require('express');
var bodyParser = require('body-parser');
var redis = require('redis');
var client = redis.createClient({
    url: "redis://redis-13027.c55.eu-central-1-1.ec2.cloud.redislabs.com:13027",
    password: "3jlJ8ErHV8h9mobXD97SXMnhn0PjbZ3L"
});

var app = express();
app.set('view engine', 'ejs');

app.use(bodyParser.urlencoded({
    extended: true
}));

app.use(bodyParser.json());

async function getAllMovies() {
    await client.connect();
    let numberOfKeys = await client.keys("movie:*");
    let movies = new Array();
    for (let i = 0; i < numberOfKeys.length; i++) {
        movies.push(await client.hGetAll("movie:" + i));
    }
    await client.disconnect();
    return movies;
}

async function getMovie(id) {
    await client.connect();
    let movie = await client.hGetAll("movie:" + id);
    await client.disconnect();
    return movie;
}

async function getActorsForMovie(id) {
    await client.connect();
    let actorsInMovie = await client.lRange("actors:movie:" + id, 0, -1);
    await client.disconnect();
    return actorsInMovie;
}

async function getProductionCountriesForMovie(id) {
    await client.connect();
    let productionCountriesForMovie = await client.sMembers("production_country:movie:" + id);
    await client.disconnect();
    return productionCountriesForMovie;
}

async function getSummaryForMovie(id) {
    await client.connect();
    let summaryForMovie = await client.get("summary:movie:" + id);
    await client.disconnect();
    return summaryForMovie;
}

async function getAwardsForMovie(id) {
    await client.connect();
    let awardsForMovie = await client.zRangeWithScores("awards:movie:" + id, 0, -1);
    console.log(awardsForMovie)
    await client.disconnect();
    return awardsForMovie;
}

app.get('/', function (req, res) {
    let allMovies = getAllMovies();
    allMovies.then(function (result) {
        res.render('main', {
            movies: result
        })
    })
})

app.get('/movie/:id', function (req, res) {
    let id = req.params['id'];
    let movie = getMovie(id);
    movie.then(function (result1) {
        let actors = getActorsForMovie(id);
        actors.then(function (result2) {
            let productionCountries = getProductionCountriesForMovie(id);
            productionCountries.then(function (result3) {
                let summary = getSummaryForMovie(id);
                summary.then(function (result4) {
                    let awards = getAwardsForMovie(id);
                    awards.then(function (result5) { 
                        res.render('movie', {
                            movie: result1,
                            actors: result2,
                            productionCountries: result3,
                            summary: result4,
                            awards: result5
                        })
                    })
                    
                })
            })
        })
    })
})

console.log("Server is listening...")
app.set('port', process.env.PORT || 3000);
app.listen(app.get('port'));