Here's how it works. This runs in node.js (server-side JavaScript) and uses the [Wordnik API](http://developer.wordnik.com) to pick out random words, parts of speech, and associated rhymes. The basic algorithm is:

* Get a random word and its part of speech. Get a 'line' for that word based on the part of speech. For example if it's a noun, it'll pick from a bunch of noun lines, like "I'm the illest MC to ever rock the [noun]"
* Once I have that first word, get a list of words that rhyme with it. (Wordnik is sort of inconsistent on this.)
* If I get back any rhyming words, then I pick one at random and also get its part of speech.
* I repeat what I did with the first word, getting a line to match its part of speech.
* Now I have a couplet! Repeat this 12 times, which will get us anywhere from 0 (if it couldn't find rhymes for any words at all, a rare case) to 12 couplets.
