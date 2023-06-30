import { run, Environment } from './src/main.js';

const debug = true;

const source = `#as palimpsest

to conditional——:
    let tomorrow be not coming
    let moon be “an icy pit”
    let sweetgum be petrified
    let sun be “a foul black tire fire”
    let owl be “pinprick eyes”
    let raccoon be “hot tar stain”
    let shirt be “plastic ditch-litter”
    let kitchen be “cow’s corpse”
    
    let future be bright
    let future be stuck
    let future be “bum star”
    let future be not “coming close”
    let future be not “dazzling”

    let her|him be absent

    let end be “staring at each other”
    let end be “hands knotted together”
    let end be “clutching the dog”
    let end be “watching the sky burn”.

† conditional——
say—“It doesn’t matter.”—
say—“That would be enough.”—
let this be “us alive”
let this be “right here”
let this be “feeling lucky”
let you be wanting
this`;

function handleError(e, source = "") {
  if (!e) return null;
  console.error(e);
}

function handleOutput(...txt) {
  console.log(...txt);
}

const browserEnv = new Environment();
try {
  // console.log(run(source, browserEnv, handleOutput, false));
  let echo = run(source, browserEnv, debug);
  console.log(echo);
  handleError(null);
} catch (e) {
  handleError(e, source);
}