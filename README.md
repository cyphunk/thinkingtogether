Code for the Thinking Together / The Wisdom of Crowds (working title) theatre show.

The show involves an audience contributing and voting on phrases and signals shown
on stage and utilized by two more more actors. I've used the Reactjs framework in
hopes this would make prototyping more fluid. In retrospect I'm not sure it was the
best choice. It's nice that it automatically handles addition and removal of elements
but as with all frameworks, the abstractions often create problems. And abstraction
from React is rather deep, making resolving some issues more time intensive than if
one were to work from scratch. _Update: And now coming back to it a month later
after having had to go on and work on several other projects, I find getting back
into it enough to fix some things to be quiet a headache._

Warning, definitely dirty code. Probably will not have time to clean up until after
the premier.


## Run

## Build

```
npm run build
npm run build_app
npm run build_stage
npm run build_admin
```

compressed

```
npm run comp
npm run comp_app
npm run comp_stage
npm run comp_admin
```

## Errata

* Writer text field does not clear on epoch end.  
  ``clear_signals_on_epoch`` intentionally does NOT clear the writer textarea soasto
  avoid clear the textarea if the user was unaware of a epoch ending and was in
  the middle of proposing a new signal.
  If this is a serious issue one resolution could be to clear the users local signal
  on epoch end, if that signal matches what was in the submitted signals db/hash stored
  locally
* Stage reload resets config (such as signal vote threshold).  
  this is because server init emit message only sends stage config. Could change
  and add the entire config. For now: DO NOT REFRESH STAGE BROWSER. Or, on refresh
  change anything in admin to have the set_config message propegate through
* Voter Mode OFF means latest message shows up first. But if any signals had votes, they show up before that list. This lets the admin force certain messages above the pit that constantly updates. The admin does this by opening a client and adding  "voter" to the hash, which will override the global voter.enabled flag  
