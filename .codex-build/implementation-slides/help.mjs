import {Presentation} from '@oai/artifact-tool';
const p=Presentation.create();
console.log(p.help('*',{search:'slides.delete|slides.remove|shapes.delete|deleteAll|slides.add',include:['index','examples','notes'],maxChars:10000}).ndjson);
