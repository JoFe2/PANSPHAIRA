// Original #567 B1: proposal-only onboarding surface inside the EXISTING
// configuration view. The user's own bounded intent travels as inert data to
// the code-owned proposal owner over the SAME session+CSRF-bound configuration
// attachment; the answer is one closed typed proposal plus at most closed
// clarifying questions. Nothing here is authority: only the explicit
// confirmation posts a versioned delta through the existing draft save, and
// every error path keeps the same draft for manual non-AI continuation.
import {text} from './api-v1.js';
interface ProposalEntry {field:string;value:unknown;rationale:string}
interface ProposalValue {schemaVersion:'pansphaira.agent-configuration/proposal/v1';expectedRevision:number;proposals:readonly ProposalEntry[];clarifications:readonly {field:string;question:string}[];proposalDigest:string}
interface Readback {schemaVersion:'pansphaira.agent-configuration/proposal-readback/v1';outcome:string;reason:string;expectedRevision:number;newRevision:number|null;proposal:ProposalValue|null;draftRetained:true;activationAuthorized:false;realModelAcceptance:false}
export function createConfigurationProposalViewV1(options:{signal:AbortSignal;alive:()=>boolean;live:()=>boolean;revision:()=>number;request:(method:'GET'|'POST',payload?:unknown,path?:string)=>Promise<{status:number;value:unknown}>;busy:(value:boolean)=>void;applied:(newRevision:number)=>void;answer:(field:string)=>void}){
 const root=text('section','');root.className='configuration-proposal';root.dataset.configurationProposal='';
 let busy=false,pending:ProposalValue|null=null;
 const heading=text('h2','Begrenzter KI-Vorschlag — Erklärungspflichtig, ohne Automatik');
 const intro=text('p','Ihre eigene kurze Absicht wird als unvertraute Datenanfrage an denselben geschützten Verbindungs- und Entwurfsowner gesendet. Ein Vorschlag ist nur ein erklärter Kandidat: nichts wird ohne Ihre ausdrückliche Auswahl gespeichert, keine Veröffentlichung oder Ausführung autorisiert, kein Modellwechsel oder Retry ausgelöst.');
 const status=text('p','');status.setAttribute('role','status');status.setAttribute('aria-live','polite');status.tabIndex=-1;
 const intent=document.createElement('textarea');intent.required=true;intent.maxLength=320;intent.rows=2;intent.dataset.proposalIntent='';
 const intentLabel=text('label','Meine Absicht (maximal 320 Zeichen, reine Eingabe — kein Befehl)');intentLabel.append(intent);
 const propose=text('button','Begrenzten Vorschlag anfragen') as HTMLButtonElement;propose.type='button';propose.dataset.proposalAction='propose';
 const answerHost=text('div','');
 root.append(heading,intro,status,intentLabel,propose,answerHost);
 function accepted(value:unknown):value is Readback{const v=value as Readback|null;return !!v&&v.schemaVersion==='pansphaira.agent-configuration/proposal-readback/v1'&&v.draftRetained===true&&v.activationAuthorized===false&&v.realModelAcceptance===false&&typeof v.outcome==='string';}
 function controls(){for(const n of root.querySelectorAll<HTMLButtonElement|HTMLInputElement|HTMLTextAreaElement>('button,input,textarea'))n.disabled=busy||!options.live();}
 function render(value:Readback){answerHost.replaceChildren();pending=null;
  if(value.outcome==='PROPOSED'&&value.proposal){const proposal=value.proposal;pending=proposal;status.textContent='Vorschlag erhalten (Revision '+value.expectedRevision+'). Nur ausgewählte Felder werden nach ausdrücklicher Bestätigung als versionierter Delta gespeichert; keine Modellabnahme, keine Ausführung.';
   const list=document.createElement('ul');const picks:HTMLInputElement[]=[];
   for(const entry of proposal.proposals){const li=document.createElement('li');const label=document.createElement('label');const input=document.createElement('input');input.type='checkbox';input.value=entry.field;input.dataset.proposalField=entry.field;picks.push(input);label.append(input,document.createTextNode(entry.field+' = '+JSON.stringify(entry.value)));li.append(label,text('p','Begründung: '+entry.rationale));list.append(li);}
   answerHost.append(list);
   for(const c of proposal.clarifications){const row=text('p','Rückfrage: '+c.field+' — '+c.question);const answer=text('button','Diese Frage im selben Entwurf beantworten') as HTMLButtonElement;answer.type='button';answer.dataset.proposalAnswer=c.field;answer.addEventListener('click',()=>{if(busy||!options.live())return;options.answer(c.field);},{signal:options.signal});row.append(document.createTextNode(' '),answer);answerHost.append(row);}
  answerHost.append(text('p','Rückfragen sind Hinweise auf offene Werte desselben verbindlichen Entwurfs — beantwortbar ohne KI im bestehenden Formular, mit ausdrücklicher Bestätigung und Readback.'));
   const confirm=text('button','Ausgewählte Felder bestätigen und Entwurf speichern') as HTMLButtonElement;confirm.type='button';confirm.dataset.proposalAction='confirm';
   confirm.addEventListener('click',()=>void sendConfirm(proposal.proposalDigest,proposal.expectedRevision,picks.filter(p=>p.checked).map(p=>p.value)),{signal:options.signal});
   answerHost.append(confirm);controls();return;}
  status.textContent=value.outcome==='NOTHING_TO_PROPOSE'?'Keine offenen Fragen mehr — der aktuelle Entwurf braucht keinen Vorschlag.':value.outcome==='APPLIED'?'Bestätigter Delta gespeichert und vom selben Entwurfsowner gelesen (Revision '+value.newRevision+'). Entwurf bleibt Entwurf; keine Veröffentlichung.':value.outcome==='REVISION_CONFLICT'?'Der Entwurf hat sich während der Anfrage geändert. Der späte Vorschlag wurde verworfen; Ihr aktueller Stand gewinnt.':value.outcome==='CONTEXT_TOO_LARGE'?'Der minimierte Kontext wäre zu groß. Ohne KI manuell fortfahren — nichts wurde gesendet.':value.outcome==='PROPOSAL_INVALID'?'Modellantwort formatabgelehnt (>'+value.reason+'). Kein Retry, kein Anbieterwechsel; derselbe Entwurf bleibt für manuelle Fortsetzung.':value.outcome==='MODEL_UNAVAILABLE'?'Modell nicht verfügbar ('+value.reason+'). Kein blinder Retry, keine erfundene Nutzung; ohne KI fortfahren.':value.outcome==='PROPOSAL_STALE'?'Vorschlag abgelaufen oder verbraucht. Expressiv neu anfragen; der Entwurf blieb unverändert.':'Vorschlag abgelehnt ('+value.reason+'). Ohne KI fortfahren — keine Änderung am Entwurf.';
  answerHost.append(text('p','Manuelle Fortsetzung über das bestehende Formular bleibt jederzeit möglich.'));
 }
 async function proposeRequest(){if(busy||!options.live())return;const text0=intent.value.trim();busy=true;options.busy(true);controls();status.textContent='Vorschlagsanfrage läuft über die bestehende qualifizierte Verbindung …';
  try{const result=await options.request('POST',{schemaVersion:'pansphaira.agent-configuration/proposal-request/v1',expectedRevision:options.revision(),confirm:true,intent:text0},'/workspace/configuration-proposal');if(!options.alive())return;
   if(result.status!==200||!accepted(result.value)){status.textContent='Vorschlagsanfrage abgelehnt (HTTP '+result.status+'). Keine Annahme; ohne KI fortfahren.';return;}
   render(result.value);if(result.value.outcome==='APPLIED'&&result.value.newRevision!==null){pending=null;options.applied(result.value.newRevision);}status.focus();
  }catch{if(options.alive())status.textContent='Vorschlagsanfrage nicht abgeschlossen. Kein automatischer Wiederholversuch; aktueller Entwurf bleibt maßgeblich.';}
  finally{busy=false;options.busy(false);controls();}}
 async function sendConfirm(proposalDigest:string,expectedRevision:number,acceptedFields:readonly string[]){if(busy||!options.live()||!acceptedFields.length){status.textContent='Mindestens ein vorgeschlagenes Feld ausdrücklich auswählen.';return;}
  busy=true;options.busy(true);controls();status.textContent='Bestätigter Delta wird über den bestehenden Entwurfsspeicher geschrieben …';
  try{const result=await options.request('POST',{schemaVersion:'pansphaira.agent-configuration/proposal-confirm/v1',expectedRevision,proposalDigest,acceptedFields,confirm:true},'/workspace/configuration-proposal');if(!options.alive())return;
   if(result.status!==200||!accepted(result.value)){status.textContent='Bestätigung nicht übernommen (HTTP '+result.status+'). Nicht automatisch wiederholen; Entwurf ausdrücklich neu lesen.';return;}
   render(result.value);if(result.value.outcome==='APPLIED'&&result.value.newRevision!==null)options.applied(result.value.newRevision);status.focus();
  }catch{if(options.alive())status.textContent='Bestätigungsausgang unklar. Keine automatische Wiederholung; Entwurf und Vorschlagsstatus ausdrücklich neu lesen.';}
  finally{busy=false;options.busy(false);controls();}}
 propose.addEventListener('click',()=>void proposeRequest(),{signal:options.signal});
 intent.addEventListener('input',()=>controls(),{signal:options.signal});
 controls();
 return {root,controls,clear(){pending=null;answerHost.replaceChildren();},isPending:()=>pending!==null};
}
