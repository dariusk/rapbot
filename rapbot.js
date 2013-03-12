var APIKEY = require('./config.js').key;
var _ = require('lodash');
var I = require('inflection');
var request = require('request');
var article = require('./lib/indefinite');
var Wordnik = require('wordnik-bb').init(APIKEY);
var apicount = 0;

_.mixin(require('underscore.deferred'));

// fill the blacklist from a file

var fs = require('fs');
var blacklist = [];
try {
  var data = fs.readFileSync('badwords.txt', 'ascii');
  data.split('\n').forEach(function (line) {
    if(line.length>0) {
      blacklist.push(line);
    }
  });
}
catch (err) {
  console.error("There was an error opening the file:");
  console.log(err);
}

var lineTemplatesDir = 'line-templates';
var lineTemplates = {};
fs.readdirSync(lineTemplatesDir).filter(function(fileName) {
	return /\.json$/i.test(fileName);
}).forEach(function(fileName) {
	var templateStrings = require('./' +lineTemplatesDir+ '/' + fileName);
	var templates= templateStrings.map(function(templateString) {
		return _.template(templateString);
	});
	lineTemplates[fileName.slice(0, -5)] = templates;
});

var randomWords = {
  noun: [],
  adj: [],
  verb: [],
  pnoun: [],
  adv: [],
  inter: []
};


var express = require('express'),
  app = express();
app.use(express.logger());
app.listen(3000);
console.log('Express server started on port 3000');


function getCoupletPromise() {

  var coupletDeferred = _.Deferred();
  var coupletPromise = coupletDeferred.promise();
  var randomWordType, randomWordPos;
  var rnd = Math.random();

  if (rnd < 0.4) {
    randomWordType = randomWords.noun;
    randomWordPos = 'noun';
  }
  else if (rnd >= 0.4 && rnd < 0.6) {
    randomWordType = randomWords.adj;
    randomWordPos = 'adjective';
  }
  else if (rnd >= 0.6 && rnd < 0.75) {
    randomWordType = randomWords.verb;
    randomWordPos = 'verb-transitive';
  }
  else if (rnd >= 0.75 && rnd < 0.85 ) {
    randomWordType = randomWords.pnoun;
    randomWordPos = 'proper-noun';
  }
  else if (rnd >= 0.85 && rnd < 0.95) {
    randomWordType = randomWords.adv;
    randomWordPos = 'adverb';
  }
  else {
    randomWordType = randomWords.inter;
    randomWordPos = 'interjection';
  }

  var word = new Wordnik.Word({
    word: I.singularize(randomWordType[Math.floor(Math.random()*randomWordType.length)].word),
    params: {
      relationshipTypes: 'rhyme',
      limitPerRelationshipType: 100,
      hasDictionaryDef: true,
      useCanonical: false
    }
  });

  // We could also get more info about the random word, in this case, relatedWords that rhyme:
  word.getRelatedWords()
    .then(function () {
      apicount+=1;
    if (isBlacklisted(word.id)) {
      coupletDeferred.resolve("");
    }
    if (word.get("relatedWords").length > 0) {
      var wordPos = randomWordPos;
      var first = getLine(word.id, wordPos);
      if (first === "") {
        coupletDeferred.resolve(first);
      }
      else {
        var word2 = word.get("relatedWords")[0].words[Math.floor(Math.random() * word.get("relatedWords")[0].words.length)];
        // quit this couplet if blacklisted word comes up
        if (isBlacklisted(word2)) {
          coupletDeferred.resolve("");
        }

        var posPromise = getPartOfSpeech(word2);
        (function (first, word2) {

          posPromise.done(function (pos) {
            var result = "oops!";
            result = getLine(word2, pos);
            if (result === "") {
              coupletDeferred.resolve(result);
            }
            else {
              var regex = /(<([^>]+)>)/ig;
              coupletDeferred.resolve("<div class=\"couplet\">" + first + "\n<br>" + result + "\n<a href=\"https://twitter.com/share?text="+first.replace(regex,"")+" / "+result.replace(regex,"")+" #RapBot\" class=\"twitter-share-button\" data-lang=\"en\" data-url=\"http://rapbot.jit.su\" data-count=\"none\">Tweet!</a><script>!function(d,s,id){var js,fjs=d.getElementsByTagName(s)[0];if(!d.getElementById(id)){js=d.createElement(s);js.id=id;js.src=\"https://platform.twitter.com/widgets.js\";fjs.parentNode.insertBefore(js,fjs);}}(document,\"script\",\"twitter-wjs\");</script></div>");
            }
          });
        })(first, word2);
      }
    }
    else {
      //coupletDeferred.resolve("Sorry. We couldn't find anything that rhymes with " + word.id + "!");
      coupletDeferred.resolve("");
    }
  });
  return coupletDeferred.promise();
}
app.use('/js', express.static(__dirname + "/js"));

app.get('/', function (req, res) {
  var beats = '';
  var license = '';
  var beatUrl = '';
  var beatName = '';
  var beatAuthor = '';

  request('http://ccmixter.org/api/query?tags=hip_hop+instrumental+bpm_100_105&f=json', function(err, res, body) {
    var music = JSON.parse(body);
    var index = Math.floor(Math.random() * music.length);
    beats = music[index].files[0].download_url;
    license = music[index].license_name;
    beatUrl = music[index].file_page_url;
    beatName = music[index].upload_name;
    beatAuthor = music[index].user_name;
  });

  var cypher = "";
  // get a bunch of random words so we don't have to call the API every time
  var randomWordNounPromise = getRandomWordsPromise('noun');
  var randomWordAdjPromise = getRandomWordsPromise('adjective');
  var randomWordVerbPromise = getRandomWordsPromise('verb-transitive');
  var randomWordPNounPromise = getRandomWordsPromise('proper-noun');
  var randomWordIntPromise = getRandomWordsPromise('interjection',100);
  var randomWordAdvPromise = getRandomWordsPromise('adverb');

  _.when(
      randomWordNounPromise,
      randomWordAdjPromise,
      randomWordVerbPromise,
      randomWordPNounPromise, 
      randomWordIntPromise, 
      randomWordAdvPromise
    ).done(function() {
    var stuffToDo = [];
    for (var i = 0; i < 12; i++) {
      var cp = getCoupletPromise();
      cp.done(function (couplet) {
        if (couplet !== "") {
          cypher += (couplet);
        }
      });
      stuffToDo.push(cp);
    }

    _.when(stuffToDo).done(function () {
      cypher += "<br>*drops the mic*<br><br><a href=\"\">Yo, reload for more!</a> | <button id='rap' onclick='rap()'>MAKE IT RAP</button> | <span id='info' style='display:none'>Track: <a href='"+ beatUrl +"'>" + beatName  + " by " + beatAuthor + "</a>, used under a " + license + " license.</span><br><a href=\"https://github.com/dariusk/rapbot/blob/master/howitworks.md\">how it works</a> | <a href=\"https://github.com/dariusk/rapbot\">source code</a> | <a href=\"http://developer.wordnik.com\">thank u based Wordnik</a>";
      res.send('<!doctype html><html><head><title>RapBot: a Freestyle 80s Battle Rap Generator</title><style type="text/css">body {font-family:sans-serif;max-width:650px;font-size:1.2em;} a {color: rgb(35, 40, 104); text-decoration:none;} .couplet:hover{background:#ddd;} h1, h3, h4{margin: 0;} .twitter-share-button{float:right;}</style><script src="js/speakClient.js"></script></head><body><audio id="track" src="' + beats  + '"></audio><div id="audio"></div><h1>RapBot</h1><h3>freestyle 80s battle rap generator by <a href=\"http://tinysubversions.com\">Darius Kazemi</a></h3><p>' + cypher + '</p><script type="text/javascript"> var _gaq = _gaq || []; _gaq.push(["_setAccount", "UA-37844294-2"]); _gaq.push(["_trackPageview"]); (function() { var ga = document.createElement("script"); ga.type = "text/javascript"; ga.async = true; ga.src = ("https:" == document.location.protocol ? "https://ssl" : "http://www") + ".google-analytics.com/ga.js"; var s = document.getElementsByTagName("script")[0]; s.parentNode.insertBefore(ga, s); })(); </script><script>document.getElementById("track").volume = 0.2;var couplets = document.getElementsByClassName("couplet");var speakText = "";for (var i=0;i<couplets.length;i++) {speakText += couplets[i].innerText.replace(/\\n/,". ").replace(/$/,". ").replace(/Tweet!/g,"").replace("MC","emcee").replace("DJ","deejay");} function rap() {speak.play(speakText); document.getElementById("track").play(); document.getElementById("info").style.cssText = "display: inline;";} </script></body></html>');
    console.log("count: ",apicount);

    });

  });
});


function getPartOfSpeech(wordId) {
  // accepts a word string
  var word = new Wordnik.Word({
    word: wordId,
    params: {
      includeSuggestions: true
    }
  });
  return word.getDefinitions()
    .then(function (word) {
      apicount++;
      return word.get("definitions")[0].partOfSpeech;
  }).promise();
}

var lineHelpers = {
  ladiesFellas: function() {
    return (Math.random() < 0.5) ? "ladies" : "fellas";
  },
  womanMan: function() {
    return (Math.random() < 0.5) ? "woman" : "man";
  },
  sistasHomies: function() {
    return (Math.random() < 0.5) ? "sistas" : "homies";
  },
  sheHe: function() {
    return (Math.random() < 0.5) ? "she" : "he";
  },
  youMe: function() {
    return (Math.random() < 0.5) ? "you" : "me"
  }
};
function w(word) {
  return "<a href='http://www.wordnik.com/words/" + word + "'>" + word + "</a>";
}

function getLine(word, pos) {

  var result = "Oops, we didn't account for something.";
  var pre;
  // The article helper must be generated in the context of the current word
  lineHelpers.a = function() { return article(word); };

  if (/noun/i.test(pos)) {
    word = I.singularize(word);
  }

  if (pos in lineTemplates) {
    pre = lineTemplates[pos];
    result = pre[Math.floor(Math.random() * pre.length)](lineHelpers) + " " + w(word);
  }
  else if (pos === 'interjection') {
    result = "*skratch solo* ... (" + word[0] + "-" + word[0] + "-" + w(word) + "!)";
  }
  else {
    result = "";
  }

  return result;

}

function isBlacklisted(data) {
  var result = false;
  for (var i=0;i<blacklist.length;i++) {
    if (data.indexOf(blacklist[i]) >= 0) {
      result = true;
    }
  }
  return result;
}

function getRandomWordsPromise(pos,minCount) {
  var minCount = minCount || 4000;
  var url = "http://api.wordnik.com//v4/words.json/randomWords?includePartOfSpeech="+pos+"&excludePartOfSpeech=proper-noun-plural,proper-noun-posessive,suffix,family-name,idiom,affix&minCorpusCount="+minCount+"&hasDictionaryDef=true&limit=1000&api_key=" + APIKEY;
  var rwDeferred = _.Deferred();
  var randomWordNounPromise = rwDeferred.promise();
  request({
    url: url
  }, function (error, response, body) {
    apicount++;
    if (JSON.parse(body).message === "exceeded access limits") {
      console.log("We're over the access limit, nooo!");
      rwDeferred.reject(error);
    }
    else if (!error && response.statusCode === 200) {
      //console.log(JSON.parse(body).word);
      //console.log(I.singularize(JSON.parse(body).word));
      rwDeferred.resolve(JSON.parse(body));
    }
    else {
      rwDeferred.reject(error);
    }
  });

  (function(pos) {
    randomWordNounPromise.done(function(words) {
      if (pos === "noun") {
        randomWords.noun = words;
      }
      else if (pos === "adjective") {
        randomWords.adj = words;
      }
      else if (pos === "verb-transitive") {
        randomWords.verb = words;
      }
      else if (pos === "proper-noun") {
        randomWords.pnoun = words;
      }
      else if (pos === "interjection") {
        randomWords.inter = words;
      }
      else if (pos === "adverb") {
        randomWords.adv = words;
      }

    });
  })(pos);

  return randomWordNounPromise;
}
