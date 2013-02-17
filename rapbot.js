var APIKEY = require('./config.js').key;
var _ = require('underscore.deferred');
var I = require('inflection');
var request = require('request');
var article = require('./lib/indefinite');
var Wordnik = require('wordnik-bb').init(APIKEY);

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

var express = require('express'),
  app = express();
app.use(express.logger());
app.listen(3000);
console.log('Express server started on port 3000');

function getCoupletPromise() {

  var coupletDeferred = _.Deferred();
  var coupletPromise = coupletDeferred.promise();

  var url = "http://api.wordnik.com//v4/words.json/randomWord?includePartOfSpeech=noun,adjective,verb-transitive&excludePartOfSpeech=proper-noun,proper-noun-plural,proper-noun-posessive,suffix,family-name,idiom,affix&minCorpusCount=4000&hasDictionaryDef=true&api_key=" + APIKEY;
  var rwDeferred = _.Deferred();
  var randomWordPromise = rwDeferred.promise();
  request({
    url: url
  }, function (error, response, body) {
    if (!error && response.statusCode === 200) {
      //console.log(JSON.parse(body).word);
      //console.log(I.singularize(JSON.parse(body).word));
      var word = new Wordnik.Word({
        word: I.singularize(JSON.parse(body).word),
        params: {
          relationshipTypes: 'rhyme',
          limitPerRelationshipType: 100,
          hasDictionaryDef: true
        }
      });
      rwDeferred.resolve(word);

    }
    else {
      rwDeferred.reject(error);
    }
  });

  randomWordPromise.done(function (word) {
    //console.log("The model for our random word: ", word);
    // We could also get more info about the random word, in this case, relatedWords that rhyme:
    _.when(word.getRelatedWords(),word.getDefinitions())
      .then(function () {
      if (isBlacklisted(word.id)) {
        coupletDeferred.resolve("");
      }
      if (word.get("relatedWords").length > 0) {
        var wordPos = word.get("definitions")[0].partOfSpeech;
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
                coupletDeferred.resolve("<div class=\"couplet\">" + first + "\n<br>" + result + "\n<a href=\"https://twitter.com/share?text="+first.replace(regex,"")+" / "+result.replace(regex,"")+" #RapBot\" class=\"twitter-share-button\" data-lang=\"en\" data-url=\"http://rapbot.jit.su\">Tweet!</a><script>!function(d,s,id){var js,fjs=d.getElementsByTagName(s)[0];if(!d.getElementById(id)){js=d.createElement(s);js.id=id;js.src=\"https://platform.twitter.com/widgets.js\";fjs.parentNode.insertBefore(js,fjs);}}(document,\"script\",\"twitter-wjs\");</script></div>");
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
  });
  return coupletDeferred.promise();
}

app.get('/', function (req, res) {

  var cypher = "";

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
    //console.log(cypher);
    //console.log('*drops the mic*');
    cypher += "<br>*drops the mic*";
    res.send('<!doctype html><html><head><title>Freestyle 80s Battle Rap Generator</title><style type="text/css">body {font-family:sans-serif;max-width:650px;font-size:1.2em;} a {color: rgb(35, 40, 104); text-decoration:none;} .couplet:hover{background:#ddd;} h1, h3{margin: 0;} .twitter-share-button{float:right;}</style></head><body><h1>RapBot</h1><h3>freestyle 80s battle rap generator by <a href=\"http://tinysubversions.com\">Darius Kazemi</a></h3><p>' + cypher + '</p><script type="text/javascript"> var _gaq = _gaq || []; _gaq.push(["_setAccount", "UA-37844294-1"]); _gaq.push(["_trackPageview"]); (function() { var ga = document.createElement("script"); ga.type = "text/javascript"; ga.async = true; ga.src = ("https:" == document.location.protocol ? "https://ssl" : "http://www") + ".google-analytics.com/ga.js"; var s = document.getElementsByTagName("script")[0]; s.parentNode.insertBefore(ga, s); })(); </script></body></html>');

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
  var deferred = _.Deferred();
  word.getDefinitions()
    .then(function (word) {
    deferred.resolve(word.get("definitions")[0].partOfSpeech);
  });
  return deferred.promise();
}

function ladiesFellas() {
  return (Math.random() < 0.5) ? "ladies" : "fellas";
}

function womanMan() {
  return (Math.random() < 0.5) ? "woman" : "man";
}

function sistasHomies() {
  return (Math.random() < 0.5) ? "sistas" : "homies";
}

function sheHe() {
  return (Math.random() < 0.5) ? "she" : "he";
}

function w(word) {
  return "<a href='http://www.wordnik.com/words/" + word + "'>" + word + "</a>";
}

function getLine(word, pos) {

  var result = "Oops, we didn't account for something.";

  if (pos === 'adjective') {
    var pre = [
      "You can try and battle me, but you're too ",
      "I make the MCs in the place wish that they were ",
      "My rhymes blow your mind and you think it's ",
      "My sweet-ass rhymes make your " + womanMan() + " feel ",
      "Now I'm gonna tell you why you ain't ",
      "You'll never beat me 'cause I'm so ",
      "If you're gonna battle me, then you gotta be ",
      "When I rock a mic you know I rock it real ",
      "If a rapper tries to step I'm gonna get ",
      "When I'm on the stage the " + ladiesFellas() + " get ",
      "I'm smooth, you'll never catch me acting "
      ];
    result = pre[Math.floor(Math.random() * pre.length)] + w(word);
  }
  else if (pos === 'noun') {
    var a = article(word) + " ";
    var pre = [
      "I'm the illest MC to ever rock the ",
      "When I'm on the mic you realize you're " + a,
      "My rhymes bring the power like a raging ",
      "If you can't handle this then you're nothing but " + a,
      "When I come to a battle I'm strapped with " + a,
      "When you battle me it's like you battle " + a,
      "Every other MC is a sucker ",
      "There's nobody like me 'cause I'm the greatest ",
      "You hear my freestyle and you drop your ",
      "My flow and my style both blow away the ",
      "My posse's got my back and my " + sistasHomies() + " got my ",
      "Sweeter than molasses, and stronger than " + a,
      "Try to step to me and I'mma wreck your ",
      "Wherever I go, people give me some ",
      "You're nothin' but a scrub, word to your ",
      "I'm a lyricist, I'm a microphone ",
      "I write my rhymes while I chill in my ",
      "They called me a new jack, but I'm a new ",
      "Master of the game, I'm the rap ",
      "I know what you want, what you want's " + a,
      "My DJ is the backup and I'm the "
      ];
    result = pre[Math.floor(Math.random() * pre.length)] + w(I.singularize(word));
  }
  else if (pos === 'proper-noun') {
    var a = article(word) + " ";
    var pre = [
      "I'm playing you and your best friend ",
      "I know how to charm a " + womanMan() + ", just ask your friend ",
      "I've battled every MC, every Tom, Dick, and ",
      "You wish you had a DJ like DJ "
      ];
    result = pre[Math.floor(Math.random() * pre.length)] + w(I.singularize(word));
  }
  else if (pos === 'adverb') {
    var a = article(word) + " ";
    var pre = [
      "You know I rock the mic ",
      "I treat all the " + ladiesFellas() + " ",
      "Every body looks at me so "
      ];
    result = pre[Math.floor(Math.random() * pre.length)] + w(word);
  }
  else if (pos === 'verb-transitive') {
    var a = article(word) + " ";
    var pre = [
      "My rhyme profile makes the " + ladiesFellas() + " ",
      "My DJ is the greatest, " + sheHe() + " makes the beat ",
      "Listen to my rhyme, let your mind "
      ];
    result = pre[Math.floor(Math.random() * pre.length)] + w(word);
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

