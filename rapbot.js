var APIKEY = require('./config.js').key;
var _ = require('underscore.deferred');
var I = require('inflection');
var request = require('request');
var article = require('./lib/indefinite');
var Wordnik = require('wordnik-bb').init(APIKEY);

var express = require('express'),
    app = express();
app.use(express.logger());
app.listen(3000);
console.log('Express server started on port 3000');

function getCoupletPromise() {

var coupletDeferred = _.Deferred();
var coupletPromise = coupletDeferred.promise();

var url = "http://api.wordnik.com//v4/words.json/randomWord?includePartOfSpeech=noun&excludePartOfSpeech=proper-noun,proper-noun-plural,proper-noun-posessive,suffix,family-name,idiom,affix&minCorpusCount=5000&api_key=" + APIKEY;
var rwDeferred = _.Deferred();
var randomWordPromise = rwDeferred.promise();
request({
  url : url
}, function(error, response, body) {
  if (!error && response.statusCode === 200) {
    //console.log(JSON.parse(body).word);
    //console.log(I.singularize(JSON.parse(body).word));
    var word = new Wordnik.Word({word: I.singularize(JSON.parse(body).word), params:{
        relationshipTypes: 'rhyme',
        limitPerRelationshipType: 100,
        hasDictionaryDef: true
      }});
    word.getWord()
     .then( function() {
        rwDeferred.resolve(word);
      });

  }
  else {
    rwDeferred.reject(error);
  }
});

randomWordPromise.done(function(word) {
  //console.log("The model for our random word: ", word);
  // We could also get more info about the random word, in this case, relatedWords that rhyme:
   word.getRelatedWords()
     .then( function() {
        if (word.get("relatedWords").length > 0) {
          var a = article(word.id) + " ";
          var opens = [
            "I'm the illest MC to ever rock the ",
            "When I'm on the mic you realize you're " + a,
            "My rhymes bring the power like a raging ",
            "If you can't handle this then you're nothing but " + a,
            "When I come to a battle I'm strapped with " + a,
            "When you battle me it's like you battle " + a
            ];
        var first = opens[Math.floor(Math.random()*opens.length)] + w(word.id);
        var word2 = word.get("relatedWords")[0].words[Math.floor(Math.random()*word.get("relatedWords")[0].words.length)];
        var posPromise = getPartOfSpeech(word2);
        ( function(first) {
        
        posPromise.done(function(pos) {
          var result = "oops!";
          if (pos === 'adjective') {
            var pre = [
              "You can try and battle me, but you're too ",
              "I make the MCs in the place wish that they were ",
              "My rhymes blow your mind and you think it's ",
              "My sweet-ass rhymes make your " + womanMan() + " feel ",
              "Now I'm gonna tell you why you ain't ",
            ];
            result = pre[Math.floor(Math.random()*pre.length)] + w(word2);
          }
          else if (pos === 'noun' || pos === 'proper-noun') {
            var a = article(word.id) + " ";
            var pre = [
              "Every other MC is a sucker ",
              "There's nobody like me 'cause I'm the greatest ",
              "You hear my freestyle and you drop your ",
              "My flow and my style both blow away the ",
              "My posse's got my back and my homies got my ",
              "Sweeter than molasses, and stronger than " + a,
              "Try to step to me and I'mma wreck your ",
              "Wherever I go, people give me some "
            ];
            result = pre[Math.floor(Math.random()*pre.length)] + w(I.singularize(word2));
           }
           else if (pos === 'verb-transitive') {
             result = "My rhyme profile makes the " + ladiesFellas() + " " + w(word2);
           }
           else if (pos === 'interjection') {
             result = "*skratch solo* ... (" + word2[0] + "-" + word2[0] + "-" + w(word2) + "!)";
           }
           else {
             result = pos;
             //coupletDeferred.resolve(result);
             coupletDeferred.resolve("");
           }
         coupletDeferred.resolve(first + "\n<br>" + result + "\n<br>");
         });
        })(first);
        }
        else {
          //coupletDeferred.resolve("Sorry. We couldn't find anything that rhymes with " + word.id + "!");
          coupletDeferred.resolve("");
        }
     });
});
return coupletDeferred.promise();
}

app.get('/' , function(req, res){

  var cypher = "";

  var stuffToDo = [];
  for (var i=0;i<12;i++) {
    var cp = getCoupletPromise();
    cp.done(function(couplet) {
      if(couplet !== "") {
        cypher += (couplet);
      }
    });
    stuffToDo.push(cp);
  }

  _.when(stuffToDo).done( function() {
    console.log(cypher);
    console.log('*drops the mic*');
    cypher += "<br>*drops the mic*";
    res.send('<!doctype html><html><head><title>Freestyle 80s Battle Rap Generator</title><style type="text/css"></style></head><body style="font-family:sans-serif;width:600px;"><h1>Freestyle 80s Battle Rap Generator</h1><p>'+cypher+'</p><script type="text/javascript"> var _gaq = _gaq || []; _gaq.push(["_setAccount", "UA-37844294-1"]); _gaq.push(["_trackPageview"]); (function() { var ga = document.createElement("script"); ga.type = "text/javascript"; ga.async = true; ga.src = ("https:" == document.location.protocol ? "https://ssl" : "http://www") + ".google-analytics.com/ga.js"; var s = document.getElementsByTagName("script")[0]; s.parentNode.insertBefore(ga, s); })(); </script></body></html>');

  });

});


function getPartOfSpeech(wordId) {
  // accepts a word string
  var word = new Wordnik.Word({word: wordId, params:{includeSuggestions:true}});
  var deferred = _.Deferred();
  word.getDefinitions()
   .then( function(word) {
      deferred.resolve(word.get("definitions")[0].partOfSpeech);
    });
  return deferred.promise();
}

function ladiesFellas() {
  return (Math.random()<0.5) ? "ladies" : "fellas";
}

function womanMan() {
  return (Math.random()<0.5) ? "woman" : "man";
}

function w(word) {
  return "<a href='http://www.wordnik.com/words/"+word+"'>"+word+"</a>";
}



