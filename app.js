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

async function getNumberOfMovies() {
    await client.connect();
    let numberOfKeys = await client.keys("movie:*");
    await client.disconnect();
    return numberOfKeys.length;
}

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

async function addMovie(id, title, posterUrl, genre, release_year, director, rank, actors, production_countries, summary, awards) {
    await client.connect();
    const transaction = client.multi();
    transaction.hSet("movie:" + id, "title", title)
    transaction.hSet("movie:" + id, "posterUrl", posterUrl)
    transaction.hSet("movie:" + id, "genre", genre)
    transaction.hSet("movie:" + id, "release_year", release_year)
    transaction.hSet("movie:" + id, "director", director)
    transaction.hSet("movie:" + id, "rank", rank)

    if (Array.isArray(actors)) {
        for (let i = 0; i < actors.length; i++) {
            transaction.rPush("actors:movie:" + id, actors[i]);
        }
    } else {
        transaction.rPush("actors:movie:" + id, actors);
    }

    if (Array.isArray(production_countries)) {
        for (let i = production_countries.length - 1; i >= 0; i--) {
            transaction.sAdd("production_country:movie:" + id, production_countries[i]);
        }
    } else {
        transaction.sAdd("production_country:movie:" + id, production_countries);
    }

    transaction.set("summary:movie:" + id, summary);
    if (awards != null) {
        if (Array.isArray(awards['year']) && Array.isArray(awards['name'])) {
            for (let i = 0; i < awards['year'].length; i++) {
                transaction.zAdd("awards:movie:" + id, [{ score: awards['year'][i], value: awards['name'][i] }]);
            }
        } else {
            transaction.zAdd("awards:movie:" + id, [{ score: awards['year'], value: awards['name'] }]);
        }
    }
    await transaction.exec(function (err, results) {
        if (err) {
            throw err;
        } else {
            console.log(results);
        }
    });
    await client.disconnect();
}

async function editMovie(id, title, posterUrl, genre, release_year, director, rank, actors, production_countries, summary, awards) {
    await client.connect();
    const transaction = client.multi();
    transaction.del("movie:" + id);
    transaction.del("actors:movie:" + id);
    transaction.del("production_country:movie:" + id);
    transaction.del("summary:movie:" + id);
    transaction.del("awards:movie:" + id);
    transaction.hSet("movie:" + id, "title", title)
    transaction.hSet("movie:" + id, "posterUrl", posterUrl)
    transaction.hSet("movie:" + id, "genre", genre)
    transaction.hSet("movie:" + id, "release_year", release_year)
    transaction.hSet("movie:" + id, "director", director)
    transaction.hSet("movie:" + id, "rank", rank)
    if (Array.isArray(actors)) {
        for (let i = 0; i < actors.length; i++) {
            transaction.rPush("actors:movie:" + id, actors[i]);
        }
    } else {
        transaction.rPush("actors:movie:" + id, actors);
    }
    if (Array.isArray(production_countries)) {
        for (let i = production_countries.length - 1; i >= 0; i--) {
            transaction.sAdd("production_country:movie:" + id, production_countries[i]);
        }
    } else {
        transaction.sAdd("production_country:movie:" + id, production_countries);
    }
    transaction.set("summary:movie:" + id, summary);
    if (awards != null) {
        if (Array.isArray(awards['year']) && Array.isArray(awards['name'])) {
            for (let i = 0; i < awards['year'].length; i++) {
                transaction.zAdd("awards:movie:" + id, [{ score: awards['year'][i], value: awards['name'][i] }]);
            }
        } else {
            transaction.zAdd("awards:movie:" + id, [{ score: awards['year'], value: awards['name'] }]);
        }
    }
    await transaction.exec(function (err, results) {
        if (err) {
            throw err;
        } else {
            console.log(results);
        }
    });
    await client.disconnect();
}

async function deleteWholeMovieData(id) {
    await client.connect();
    const transaction = client.multi();
    transaction.del("movie:" + id);
    transaction.del("actors:movie:" + id);
    transaction.del("production_country:movie:" + id);
    transaction.del("summary:movie:" + id);
    transaction.del("awards:movie:" + id);
    await transaction.exec(function (err, results) {
        if (err) {
            throw err;
        } else {
            console.log(results);
        }
    });
    await client.disconnect();
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

app.get('/movie/add-form', function (req, res) {
    res.render("addmovie");
})

app.post('/movie/add', function (req, res) {
    let {
        title,
        posterUrl,
        genre,
        release_year,
        director,
        rank,
        summary,
        actors,
        production_countries,
        awards
    } = req.body;
    getNumberOfMovies().then(function (id) {
        addMovie(id, title, posterUrl, genre, release_year, director, rank, actors, production_countries, summary, awards).then(function (result1) {
            res.redirect("/");
        });
    });
})

app.get('/movie/edit-form/:id', function (req, res) {
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
                        res.render('editmovie', {
                            movie: result1,
                            actors: result2,
                            productionCountries: result3,
                            summary: result4,
                            awards: result5,
                            id: id
                        })
                    })

                })
            })
        })
    })
})

app.post('/movie/edit/:id', function (req, res) {
    let {
        title,
        posterUrl,
        genre,
        release_year,
        director,
        rank,
        summary,
        actors,
        production_countries,
        awards
    } = req.body;
    let id = req.params['id'];
    editMovie(id, title, posterUrl, genre, release_year, director, rank, actors, production_countries, summary, awards).then(function (result) {
        res.redirect("/");
    });
})

app.get('/movie/delete/:id', function (req, res) {
    let id = req.params['id'];
    deleteWholeMovieData(id).then(function (result) {
        res.redirect("/");
    });
})

app.get('/movie/info/:id', function (req, res) {
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
                            awards: result5,
                            id: id
                        })
                    })

                })
            })
        })
    })
})

console.log("Server is listening on port 3000...")
app.set('port', process.env.PORT || 3000);
app.listen(app.get('port'));