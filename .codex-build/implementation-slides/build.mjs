import fs from 'node:fs/promises';
import {Presentation,PresentationFile,FileBlob} from '@oai/artifact-tool';
import {finalizePresentation,resolvePresentationFont} from '/Users/ngwenjing/.codex/plugins/cache/openai-primary-runtime/presentations/26.927.11222/skills/presentations/container_tools/artifact_tool_utils.mjs';
const root='/Users/ngwenjing/huawei-2026';
const build=root+'/.codex-build/implementation-slides';
const skill='/Users/ngwenjing/.codex/plugins/cache/openai-primary-runtime/presentations/26.927.11222/skills/presentations';
const c={bg:'#0A0E1A',panel:'#141C2E',edge:'#24304A',green:'#00FF88',white:'#FFFFFF',muted:'#A8BBCF',soft:'#0E2418'};
const arial=resolvePresentationFont({fontFamily:'Arial'});
const calibri=resolvePresentationFont({fontFamily:'Calibri'});
const p=Presentation.create({slideSize:{width:1280,height:720}});
p.theme.defaultFont=calibri;
function text(s,str,x,y,w,h,size=24,color=c.white,bold=false,font=calibri){
 const o=s.shapes.add({geometry:'textbox',name:str.slice(0,60),position:{left:x,top:y,width:w,height:h},fill:'none',line:{fill:'none',width:0}});
 o.text=str;o.text.style={typeface:font,fontSize:size,bold,color,alignment:'left',verticalAlignment:'top',autoFit:'none',wrap:'square',insets:{left:0,right:0,top:0,bottom:0}};return o;
}
function box(s,x,y,w,h,fill=c.panel){return s.shapes.add({geometry:'roundRect',position:{left:x,top:y,width:w,height:h},borderRadius:8,fill,line:{fill:c.edge,width:1.2}});}
function line(s,x,y,w,h=0,color=c.edge,width=2){return s.shapes.add({geometry:'line',position:{left:x,top:y,width:w,height:h},fill:'none',line:{fill:color,width}});}
function base(title,subtitle){const s=p.slides.add();s.background.fill=c.bg;text(s,title,68,63,1144,58,38,c.white,true,arial);text(s,subtitle,68,140,1144,55,23,c.muted);return s;}
const s1=base('Drill Mode: current architecture','Implemented stack: family practice, real drill channels and saved progress.');
const app=box(s1,68,240,242,150);
text(s1,'Family app',88,261,206,32,27,c.white,true,arial);
text(s1,'React + TypeScript\nVite + Tailwind CSS',88,306,206,63,22,c.muted);
const api=box(s1,364,240,266,150,c.soft);
text(s1,'Backend API',386,261,225,32,27,c.green,true,arial);
text(s1,'Node.js + Express\nDrills, consent, scoring',386,306,225,66,22,c.white);
s1.shapes.connect(app,api,{kind:'straight',fromSide:'right',toSide:'left',line:{fill:c.green,width:2}});
// Channel branches are native editable diagram elements.
line(s1,630,315,46,0,c.green);line(s1,676,279,0,229,c.green);
for(const yy of [279,414,508])line(s1,676,yy,35,0,c.green);
box(s1,711,208,500,166);
text(s1,'VOICE  /  Vapi',733,224,460,31,26,c.green,true,arial);
text(s1,'Claude — conversation\nDeepgram Nova-2 — speech recognition\nAzure Speech — Singapore-English voice',733,266,458,95,22,c.white);
box(s1,711,388,500,78);
text(s1,'SMS  /  Twilio',733,398,460,28,24,c.white,true,arial);
text(s1,'Drill messages + scheduled reveal',733,431,460,28,21,c.muted);
box(s1,711,480,500,78);
text(s1,'EMAIL  /  Google Apps Script',733,490,460,28,24,c.white,true,arial);
text(s1,'MailApp templates + safety follow-up',733,523,460,28,21,c.muted);
const data=box(s1,364,437,266,121);
text(s1,'Supabase',386,451,224,30,26,c.white,true,arial);
text(s1,'PostgreSQL + Realtime\nProgress + family chat',386,491,224,57,21,c.muted);
s1.shapes.connect(api,data,{kind:'straight',fromSide:'bottom',toSide:'top',line:{fill:c.green,width:2}});
text(s1,'HOSTING',68,451,242,25,17,c.green,true,arial);
text(s1,'Vercel',68,485,242,35,27,c.white,true,arial);
text(s1,'Frontend + serverless API',68,526,250,28,20,c.muted);
line(s1,68,603,1144);
text(s1,'Phone verification: Twilio Verify     •     Account sessions: custom backend',68,622,1144,31,22,c.white);
text(s1,'Voice defaults shown; production settings may override them. Real drills are currently user-initiated.',68,667,1144,26,17,c.muted);
s1.speakerNotes.textFrame.setText(`Suggested narration (45–60 seconds):\nThe core drill system is already implemented. The React app talks to a Node and Express backend, which manages consent, drill attempts and scoring. Vapi coordinates voice calls: Claude generates the conversation, Deepgram transcribes speech and Azure Speech provides the Singapore-English voice. SMS uses Twilio; email uses Google Apps Script and MailApp. Supabase PostgreSQL stores progress and family data, and Realtime signals the apps to refresh. The repository configures Vercel for the frontend and serverless API.\n\nScope and accuracy: These are verified repository integrations, not a live production configuration audit. Claude defaults to claude-3-5-haiku-20241022; model and voice settings are overridable. Azure en-SG-WayneNeural is the default; ElevenLabs is an alternative. Twilio Verify is implemented, but the 2 October roadmap records a production demo verification bypass; resolve that before claiming verified ownership in real use. Supabase Auth is not used. SMS/email use curated templates. OpenAI GPT-5 mini exists in separate bulletin-extraction scripts, not the main drill call path. The automated Claude intelligence pipeline has all web sources disabled. Python folders are standalone earlier prototypes.\n\nSources inspected, 2 October 2026:\n${root}/package.json\n${root}/server/vapi.js\n${root}/server/sms.js\n${root}/server/verify.js\n${root}/server/email.js\n${root}/server/apps-script/Code.gs\n${root}/server/db.js\n${root}/server/doorbell.js\n${root}/src/app/house.ts\n${root}/vercel.json\n${root}/DEPLOY.md`);
const s2=base('Drill Mode: implementation plan','Next: reliable operation, recurring practice and a measured community pilot.');
const stages=[
 {n:'01',title:'Harden the\nworking system',body:'Resolve verification bypass\nTest reveal and stop flows\nTrack delivery and failures',gate:'Reliable end-to-end drills'},
 {n:'02',title:'Enable recurring\npractice',body:'Build an opt-in scheduler\nAdd quiet hours and pause\nRecheck consent each time',gate:'Drills within chosen windows'},
 {n:'03',title:'Run a small\ncommunity pilot',body:'Recruit a consenting cohort\nReview scenario variety\nTest accessibility with seniors',gate:'Usable onboarding and drills'},
 {n:'04',title:'Measure, improve\nand expand',body:'Compare safe responses\nTrack return visits and cost\nRefine before wider rollout',gate:'Evidence for a larger cohort'},
];
line(s2,68,250,1144,0,c.edge,2);
for(let i=0;i<4;i++){
 const st=stages[i],x=68+i*292;
 text(s2,st.n,x,204,100,48,38,c.green,true,arial);
 text(s2,st.title,x,276,265,78,28,c.white,true,arial);
 text(s2,st.body,x,380,267,102,21,c.muted);
 text(s2,'MILESTONE',x,504,265,23,16,c.green,true,arial);
 text(s2,st.gate,x,539,265,63,23,c.white,true);
}
line(s2,68,613,1144);
text(s2,'Pilot measures: safe responses  •  repeat practice  •  delivery reliability  •  cost',68,632,1144,34,23,c.white);
text(s2,'Proposed stages; partner and timing to be agreed. Huawei Cloud deployment remains an option to evaluate.',68,678,1144,25,17,c.muted);
s2.speakerNotes.textFrame.setText(`Suggested narration (45–60 seconds):\nWe have already built the core product, so this plan focuses on readiness for real use. First, we resolve the verification bypass and test delivery, error handling and safety flows. Next, we add a real recurring-drill scheduler with explicit opt-in, quiet hours, frequency limits and pause controls. A small consenting community cohort will then help us test accessibility and repeated practice. We will compare safe responses across comparable drills, measure repeat participation and operating cost, and use those findings to decide whether to expand.\n\nImplementation detail for questions: Recheck consent and verified destination immediately before every scheduled send, enforce per-user/channel frequency limits and prevent duplicate sends. Provider acceptance does not establish delivery; capture callbacks and show unconnected or ambiguous attempts as unscored. Prompt-based voice safeguards require real testing and should not be described as guaranteed intervention. Treat the pilot partner as prospective. Pilot timing and size are not committed. Behavioural improvement in drills does not itself prove reduced real-world scam losses; use a baseline, comparable scenarios and, where practical, a comparison group. Huawei ECS deployment instructions exist, while ModelArts migration is proposed and needs compatibility, latency and cost validation.\n\nSources:\n${root}/docs/superpowers/specs/2026-10-02-drill-mode-roadmap.md\n${root}/README.md\n${root}/TESTPLAN.md\n${root}/DEPLOY.md\nThe stage order and milestone wording are proposed for this presentation, not a claim of committed delivery dates.`);
const candidate=build+'/candidate.pptx';
await (await PresentationFile.exportPptx(p)).save(candidate);
for(let i=0;i<p.slides.items.length;i++){
 await fs.writeFile(build+`/draft-${i+1}.png`,new Uint8Array(await (await p.export({slide:p.slides.items[i],format:'png',scale:1})).arrayBuffer()));
}
const result=await finalizePresentation({workspaceDir:root,candidatePath:candidate,finalPath:root+'/output/SafeSpace_Drill_Mode_Implementation_final.pptx',pythonExecutable:'/Users/ngwenjing/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3',integrityValidatorPath:skill+'/container_tools/inspect_presentation_package_integrity.py',layoutValidatorPath:skill+'/container_tools/inspect_presentation_layout_geometry.py',layoutArgs:['--expected-slide-size-emu','12192000,6858000','--validate-bullet-geometry','--validate-heading-fit'],explicitTotalSlideCount:2,requiredNativeTableOwnerSlides:[],requiredNativeChartOwnerSlides:[],fontPolicy:{basis:'design',families:[arial,calibri]},verifyArtifactToolImport:true,receiptPath:build+'/validation-final.json'});
console.log(JSON.stringify(result,null,2));
const final=await PresentationFile.importPptx(await FileBlob.load(root+'/output/SafeSpace_Drill_Mode_Implementation_final.pptx'));
for(let i=0;i<final.slides.items.length;i++){
 await fs.writeFile(root+`/output/implementation-slide-${i+1}.png`,new Uint8Array(await (await final.export({slide:final.slides.items[i],format:'png',scale:1})).arrayBuffer()));
}
