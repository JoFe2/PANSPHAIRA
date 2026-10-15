import {verifyWorkspaceBrowserPairV1,verifyWorkspaceBrowserPairListV1,type WorkspaceBrowserPairV1} from '../../contracts/src/workspace-browser-pairing-v1.js';
import {text} from './api-v1.js';
import type {WorkspaceSurfaceRouteV2} from '../../contracts/src/workspace-surface-v2.js';
// Same SURF lifecycle/transport and existing refresh cadence. No storage,
// clipboard permission, popup placement, extension, session copy or new timer.
export function createWorkspaceBrowserPairingV1(o:{container:HTMLElement;signal:AbortSignal;ready:()=>boolean;surfaceId:()=>string|undefined;selected:()=>WorkspaceSurfaceRouteV2;request:(body:unknown)=>Promise<unknown>}){
 let current:WorkspaceBrowserPairV1|null=null,busy=false,retired=false,generation=0;
 const root=document.createElement('section');root.className='surface-browser-pairing';root.dataset.state='PAIR_CONNECTING';root.setAttribute('aria-labelledby','browser-pair.heading');
 const heading=text('h3','Browserprofile beidseitig koppeln');heading.id='browser-pair.heading';
 const intro=text('p','Vorleistung für die Präsentation: Jede Seite braucht eine eigene Anmeldung. Die Kopplung allein zeigt keine Fachdaten und gibt keine Anzeige-, Schreib- oder Audiorechte frei. Zwei Profile sind keine Geräteabnahme.');
 const controls=document.createElement('div');controls.className='surface-pair-controls';
 const offer=text('button','Kopplungscode für Dokument erzeugen')as HTMLButtonElement,confirm=text('button','Empfänger und Referenz bestätigen')as HTMLButtonElement,refreshButton=text('button','Kopplungsstatus prüfen')as HTMLButtonElement,revoke=text('button','Browserkopplung widerrufen')as HTMLButtonElement,claim=text('button','Code prüfen und als Empfänger bestätigen')as HTMLButtonElement;
 for(const b of[offer,confirm,refreshButton,revoke,claim])b.type='button';
 const output=document.createElement('input');output.id='browser-pair.offer-code';output.readOnly=true;output.autocomplete='off';output.setAttribute('aria-describedby','browser-pair.code-help');
 const outputLabel=text('label','Einmaliger Code für das andere Browserprofil');outputLabel.setAttribute('for',output.id);
 const input=document.createElement('input');input.id='browser-pair.receiver-code';input.maxLength=20;input.autocomplete='off';input.spellcheck=false;input.setAttribute('aria-describedby','browser-pair.code-help');
 const inputLabel=text('label','Code aus dem anderen Browserprofil');inputLabel.setAttribute('for',input.id);
 const help=text('p','Code exakt übernehmen. Einmalig, kurzlebig und auf fünf Prüfversuche je angemeldeter Session und Minute begrenzt. Danach bestätigt die Quelle ausdrücklich den Empfänger.');help.id='browser-pair.code-help';
 const details=text('p','Noch keine aktuelle Kopplung.');details.className='surface-pair-details';
 const status=text('p','Native Verbindung wird geprüft.');status.setAttribute('role','status');
 controls.append(offer,outputLabel,output,inputLabel,input,claim,confirm,refreshButton,revoke);root.append(heading,intro,controls,help,details,status);o.container.append(root);
 const live=()=>!retired&&!o.signal.aborted&&root.isConnected;
 function sync(){const available=live()&&o.ready()&&!busy;offer.disabled=!available;input.disabled=!live()||!o.ready();input.readOnly=busy;claim.disabled=!available;refreshButton.disabled=!available;confirm.disabled=!available||!current||current.sourceSurfaceId!==o.surfaceId()||!['CLAIMED','PAIRED'].includes(current.state);revoke.disabled=!available||!current||current.state==='REVOKED';}
 function clear(message:string,state='PAIR_UNKNOWN'){generation++;current=null;output.value='';details.textContent='Keine aktuell bestätigte Kopplung. Kein Inhalt und keine Anzeigeautorität werden aus Browserstorage wiederhergestellt.';status.textContent=message;root.dataset.state=state;delete root.dataset.pairId;sync();}
 function show(row:WorkspaceBrowserPairV1){
  if(!live())return;
  if(current?.pairId!==row.pairId)output.value='';current=row;
  if(row.code!==undefined)output.value=row.code;
  if(row.state!=='OFFERED'||Date.now()>=row.claimExpiresAtMs)output.value='';
  root.dataset.pairId=row.pairId;root.dataset.state='PAIR_'+row.state;
  details.textContent='Referenz '+row.scope.objectId+' · Workspace '+row.scope.workspaceId+' · Quelle '+row.sourceSurfaceId+' · Empfänger '+(row.targetSurfaceId??'noch nicht bestätigt')+' · Scope '+row.scopeDigest+'. Keine Feld- oder Datenklassenfreigabe.';
  const messages:Record<WorkspaceBrowserPairV1['state'],string>={OFFERED:'Code im separat angemeldeten Browserprofil prüfen. Die Quelle bestätigt anschließend den konkreten Empfänger.',CLAIMED:'Empfänger hat bestätigt. Noch keine beidseitige Kopplung: Die Quelle muss Empfänger und Referenz ausdrücklich bestätigen.',PAIRED:'Beidseitige Browserkopplung nativ bestätigt. Noch keine Präsentationssession und keine Fachdatenauslieferung.',REVOKED:'Browserkopplung nativ widerrufen. Der alte Code bleibt verbraucht.',EXPIRED:'Kopplung abgelaufen. Neuer Code und beide Bestätigungen sind erforderlich.',UNAVAILABLE:'Session, Rechte, Quelle oder Verbindung nicht mehr aktuell. Keine alte Kopplung wiederverwenden.'};status.textContent=messages[row.state];sync();
 }
 async function raw(operation:string,fields:Record<string,unknown>={}){if(!live()||!o.ready())throw Error('BROWSER_PAIR_BROWSER_RETIRED');const v=await o.request({schemaVersion:'pansphaira.workspace-surface/browser-pair-command/v1',operation,...fields});if(!live()||!o.ready())throw Error('BROWSER_PAIR_BROWSER_RETIRED');return v;}
 async function refresh(){
  if(!live()||!o.ready()||busy){sync();return;}const captured=generation;
  try{const rows=await verifyWorkspaceBrowserPairListV1(await raw('list'),location.origin);if(!live()||captured!==generation)return;const row=rows.find(r=>r.pairId===current?.pairId)??rows[0];if(row)show(row);else{if(current){clear('Alte Kopplung nicht mehr nativ vorhanden. Keine Wiederherstellung aus lokalem Zustand.');return;}if(root.dataset.state==='PAIR_UNKNOWN'){sync();return;}root.dataset.state='PAIR_READY';status.textContent='Eigene native Session verbunden. Dokument oben wählen oder einen Code des anderen Profils bestätigen.';sync();}}
  catch{if(live()&&captured===generation)clear('Kopplungsstatus nicht aktuell bestätigt. Keine automatische Wiederholung eines Codes oder einer Bestätigung.');}
 }
 async function run(operation:string,fields:Record<string,unknown>){
  if(!live()||!o.ready()||busy)return;busy=true;const captured=++generation;sync();
  try{const row=await verifyWorkspaceBrowserPairV1(await raw(operation,fields),location.origin);if(live()&&captured===generation)show(row);}
  catch{if(live()&&captured===generation)clear('Kopplung verweigert oder Ausgang unbestätigt. Code, eigene Anmeldung und aktuellen Scope prüfen; kein blindes Retry.');}
  finally{busy=false;sync();}
 }
 offer.addEventListener('click',()=>{let r:WorkspaceSurfaceRouteV2;try{r=o.selected();if(r.kind!=='DOCUMENT')throw Error('DOCUMENT_REQUIRED');}catch{clear('Oben eine native Dokumentreferenz auswählen; dieser Teilvertrag koppelt keine Analyse- oder Monitoranzeige.');return;}void run('offer',{routeId:r.routeId,objectId:r.objectId,expectedRevision:r.dataRevision});},{signal:o.signal});
 claim.addEventListener('click',()=>{const code=input.value;input.value='';void run('claim',{code,confirmation:'CONFIRM_RECEIVER_PAIRING'});},{signal:o.signal});
 input.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();claim.click();}},{signal:o.signal});
 confirm.addEventListener('click',()=>{if(current)void run('confirm',{pairId:current.pairId,targetSurfaceId:current.targetSurfaceId,scopeDigest:current.scopeDigest,confirmation:'CONFIRM_SOURCE_PAIRING'});},{signal:o.signal});
 revoke.addEventListener('click',()=>{if(current){output.value='';input.value='';void run('revoke',{pairId:current.pairId});}},{signal:o.signal});
 refreshButton.addEventListener('click',()=>{void refresh();},{signal:o.signal});
 o.signal.addEventListener('abort',()=>{retired=true;generation++;current=null;input.value='';output.value='';root.remove();},{once:true});sync();
 return Object.freeze({refresh,sync,stop(){clear('Lokale Fläche gestoppt. Kopplung nicht als peer-seitig widerrufen ausgeben, solange kein nativer Readback vorliegt.');retired=true;input.value='';sync();}});
}
