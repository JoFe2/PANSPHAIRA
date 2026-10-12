import {browserWorkspaceStringValuesV1} from "../../contracts/src/browser-shell-plugin-v1.js";
import type { BrowserShellPluginV1 } from "../../contracts/src/browser-shell-plugin-v1.js";
import type { BrowserShellFactoryV1 } from "../../browser-shell/src/registry-v1.js";
import type { AgentConfigurationReadbackV1, AgentConfigurationFieldV1, AgentConfigurationValueV1 } from "../../contracts/src/agent-configuration-draft-v1.js";
import type { BrowserContextV1 } from "../../browser-shell/src/context-owner-v1.js";
import { text } from "./api-v1.js";
import {createConfigurationTransferViewV1} from './configuration-transfer-v1.js';
import {createConfigurationGoalViewV1} from './configuration-goals-v1.js';
import {createConfigurationApplicationViewV1} from "./configuration-application-v1.js";
import type {createWorkspaceContextSelectionV1} from "./context-selection-v1.js";
import type {WorkspaceDirtyDraftV1} from './workspace-dirty-draft-v1.js';
type Readback = AgentConfigurationReadbackV1;
const groupLabels:Record<string,string>={context:"Kontext",goal:"Aufgabe und Profil",runtime:"Runtime",model:"Modell",access:"Zugang und Prüfstatus",data:"Daten",tools:"Werkzeuge",work:"Arbeitsregeln",budget:"Budgets",persistence:"Gedächtnis und Nachweise",modules:"Optionale Fachmodule"};
const valueLabels:Record<string,string>={"de-DE":"Deutsch","en-GB":"Englisch","employee.business.help":"Begrenzte Unterstützung bei der Arbeit","employee.directory.summary":"Eigenes Mitarbeiterverzeichnis zusammenfassen",
  "employee-own-directory/v1":browserWorkspaceStringValuesV1[154] as string,"pan441-pan529/v1":"Geprüfter Profil-/Runtimeadapter v1","OWNER_BOUND_LOCAL":"Eigener geschützter lokaler Dienst",
  "capability:employee.directory.read.own":"Eigenes Mitarbeiterverzeichnis lesen","synthetic-bounded/v1":"Nur synthetische lokale Referenz — kein echter KI-Agent","NONE":"Nicht ausgewählt",
  "SYNTHETIC_LOCAL_NO_PROVIDER":"Lokale Synthetik, kein Modellanbieter","BOUNDED_SYNTHETIC_READ":"Begrenzte synthetische Leseprobe","NO_CREDENTIAL":"Kein Zugangsmittel erforderlich","NOT_RUN":"Nicht ausgeführt",
  "employee.directory.own":browserWorkspaceStringValuesV1[154] as string,"OWN_REQUESTING_USER":"Nur anfragender Nutzer","READ":"Lesen","READ_ONLY":"Nur lesen","NO_EFFECT_AUTHORIZATION":"Keine Wirkung durch diesen Entwurf autorisiert",
  "DRAFT_ONLY":"Nur Konfigurationsentwurf","UNTIL_OWNER_DELETION":"Bis zur ausdrücklichen Owner-Löschung","NO_SECRETS_NO_BUSINESS_PAYLOADS":"Keine Secrets oder fachlichen Nutzdaten",
  "OWN_SCOPED_DRAFT_ONLY":"Nur eigener Konfigurationsentwurf","AUTHENTICATED_USER_TENANT_INSTANCE":"Getrennt nach Nutzer, Mandant und Instanz",
  displayName:"Anzeigename",department:"Abteilung",jobTitle:"Berufsbezeichnung",employeeAlias:"Mitarbeiteralias"};
function displayValue(value:AgentConfigurationValueV1|null):string {
  if(value===null)return "Noch nicht festgelegt / kein Zugangsmittel";
  if(Array.isArray(value))return value.map(v=>displayValue(v)).join(", ");
  return valueLabels[String(value)] ?? (String(value).startsWith("bounded-") ? "Geprüfte begrenzte Runtimevorlage" : String(value));
}
export function createConfigurationDraftViewV1(context:()=>BrowserContextV1,registerDraft?:(draft:WorkspaceDirtyDraftV1)=>()=>void,applicationContext?:ReturnType<typeof createWorkspaceContextSelectionV1>|null): BrowserShellFactoryV1<HTMLElement> {
 return {kind:"VIEW",async render({target,signal}){
  target.classList.add("configuration-draft");target.dataset.backend="configuration";
  const captured=context(),base="/t/"+captured.tenantId;
  // One accepted native readback, never a second conversational draft/store.
  let current:Readback|null=null,busy=false,transferInFlight=false,goalInFlight=false,saveInFlight=false,needsReconciliation=false,dirty=false;
  let applicationUI:ReturnType<typeof createConfigurationApplicationViewV1>|null=null;
  let transferUI:ReturnType<typeof createConfigurationTransferViewV1>|null=null;
  let goalUI:ReturnType<typeof createConfigurationGoalViewV1>|null=null;
  let step="configuration",presentation:"form"|"conversation"="form",editing:AgentConfigurationFieldV1|null=null;
  const unregister=registerDraft?.({id:'AGENT_CONFIGURATION',label:'Konfiguration',isDirty:()=>active()&&(dirty||saveInFlight||needsReconciliation||!!goalUI?.isDirty()||!!applicationUI?.uncertain()||!!transferUI?.uncertain()),async discardForNavigation(){if(!active()||busy||transferInFlight||goalInFlight||needsReconciliation||applicationUI?.uncertain()||transferUI?.uncertain())return false;if(goalUI&&!goalUI.discard())return false;dirty=false;show();return true;}});
  signal.addEventListener('abort',()=>unregister?.(),{once:true});
  const heading=text("h1","Versionierter Agentenkonfigurationsentwurf"),note=text("p","Einrichtung im gemeinsamen Arbeitsplatz. Nur erlaubte Konfiguration speichern: keine Aktivierung, Rechtevergabe, fachliche Wirkung oder kostenpflichtiger Modellaufruf.");
  const status=text("p","");status.className=browserWorkspaceStringValuesV1[203] as string;status.setAttribute("role","status");status.setAttribute("aria-live","polite");status.tabIndex=-1;
  const reload=button("Aktuellen Entwurf neu laden"),noAi=button("Ohne KI fortfahren"),summaryLink=button("Entwurfszusammenfassung anzeigen");
  const layout=text("div","");layout.className="configuration-layout";
  const steps=document.createElement("nav");steps.className="configuration-steps";steps.dataset.configurationSteps="";steps.setAttribute("aria-label","Einrichtungsschritte");
  const stepLabels:Record<string,string>={entry:"Einstieg",profile:"Profil",model:"Modellverbindung",configuration:"Konfigurationsgespräch",result:"Plan und Ergebnis"};
  for(const[key,label]of Object.entries(stepLabels)){const b=button(label);b.dataset.step=key;b.addEventListener("click",()=>{if(!active()||busy||transferInFlight||goalInFlight||needsReconciliation)return;step=key;showPresentation();introHeading.focus();},{signal});steps.append(b);}
  const work=text("section","");work.className="configuration-work";
  const introHeading=text("h2","");introHeading.tabIndex=-1;const intro=text("p","");intro.dataset.configurationIntroduction="";
  const body=text("div","");body.className="configuration-fields";const editor=text("div","");editor.className="configuration-editor";
  const presentationControls=text("div","");presentationControls.className="configuration-presentation-controls";
  const conversation=button("Konfigurationsgespräch — modelllos"),formView=button("Formular — derselbe Entwurf"),ai=button("KI-Modus — nicht verfügbar");ai.dataset.configurationAi="UNAVAILABLE";ai.disabled=true;
  const presentationNote=text("p","");
  const connection=button("Vorhandenen Verbindungsstatus anzeigen");connection.addEventListener("click",()=>{if(!active()||busy||transferInFlight||goalInFlight)return;const open=document.querySelector<HTMLButtonElement>('[id="shell.model-connection"] > button');if(open){if(open.getAttribute('aria-expanded')!=='true')open.click();open.scrollIntoView({block:'center'});open.focus();}else state("MODEL_NOT_CONFIGURED","Der bestehende Verbindungsdialog ist für diese Instanz nicht eingebunden. Ohne KI vollständig einrichten; keine Verbindung oder Inferenz angenommen.");},{signal});
  const result=text("section","");result.dataset.configurationResult="";
  if(applicationContext&&document.body.dataset.ownerConfigurationApplication==='true')applicationUI=createConfigurationApplicationViewV1({base,context:applicationContext,signal,draft:()=>current,live:()=>active()&&!dirty&&!busy&&!needsReconciliation&&!transferInFlight&&!goalInFlight});
  transferUI=createConfigurationTransferViewV1({signal,current:()=>current,live:()=>active()&&!busy&&!dirty&&!needsReconciliation&&!applicationUI?.uncertain(),alive:active,request,accept:accepted,imported(value){current=value;dirty=false;editing=null;show();step='result';showPresentation();state('IMPORTED','Untrusted Entwurf unabhängig gespeichert und gelesen. Neue Bestätigung erforderlich; letzte qualifizierte Bindung bleibt getrennt.');},unknown(){needsReconciliation=true;state('UNKNOWN','Importausgang unklar; ausdrücklich vom bestehenden Backend neu lesen, keine automatische Wiederholung.');},denied:failure,busy(value){transferInFlight=value;controls(value||busy);}});
  if(document.body.dataset.ownerConfigurationGoals==='true')goalUI=createConfigurationGoalViewV1({signal,alive:active,live:()=>active()&&!dirty&&!busy&&!transferInFlight&&!needsReconciliation&&!applicationUI?.uncertain()&&!transferUI?.uncertain(),request,busy(value){goalInFlight=value;controls(busy||transferInFlight||goalInFlight);},unknown(){needsReconciliation=true;state('UNKNOWN','Zielantwort-Speicherausgang unklar. Nicht automatisch wiederholen; aktuellen Entwurf und Zielbeitrag ausdrücklich neu lesen.');},denied:failure,async reconcileLegacy(expectedRevision){const read=await request('GET');if(!active()||read.status!==200||!accepted(read.value)||read.value.revision!==expectedRevision)return false;current=read.value;dirty=false;const priorStep=step;show();step=priorStep;showPresentation();return true;}});
  const summary=text("aside","");summary.className="configuration-summary";summary.dataset.configurationSummary="";summary.tabIndex=-1;summary.setAttribute("aria-label","Entwurfszusammenfassung");
  conversation.addEventListener("click",()=>{if(!active()||busy||transferInFlight||goalInFlight||needsReconciliation)return;step="configuration";presentation="conversation";showPresentation();},{signal});
  formView.addEventListener("click",()=>{if(!active()||busy||transferInFlight||goalInFlight||needsReconciliation)return;step="configuration";presentation="form";showPresentation();},{signal});
  noAi.addEventListener("click",()=>{if(dirty){state("UNCONFIRMED_INPUT","Ihre noch unbestätigte Eingabe bleibt erhalten. Erst diese Frage bestätigen oder ausdrücklich verwerfen; kein Modellwechsel gespeichert.");editor.querySelector<HTMLElement>('input,select')?.focus();return;}void save("model.reference","NONE","CONFIRM");},{signal});
  summaryLink.addEventListener("click",()=>{summary.scrollIntoView({block:"start"});summary.focus();},{signal});
  presentationControls.append(conversation,formView,ai);
  work.append(introHeading,intro,...(goalUI?[goalUI.root]:[]),connection,presentationControls,presentationNote,editor,body,result);layout.append(steps,work,summary);
  const actions=text("div","");actions.className="configuration-actions";actions.append(reload,noAi,summaryLink);target.append(heading,note,status,actions,layout);showPresentation();
  function button(label:string){const b=text("button",label)as HTMLButtonElement;b.type="button";return b;}
  function active(){return !signal.aborted&&context().sessionId===captured.sessionId&&context().tenantId===captured.tenantId;}
  function state(outcome:string,message:string){if(active()){target.dataset.outcome=outcome;status.textContent=message;}}
  function controls(disabled:boolean){disabled=disabled||transferInFlight||goalInFlight;for(const n of target.querySelectorAll<HTMLButtonElement|HTMLInputElement|HTMLSelectElement>("button,input,select"))if(!n.closest(".configuration-application,.configuration-transfer,.configuration-goals"))n.disabled=disabled||(needsReconciliation&&n!==reload);applicationUI?.updateControls();transferUI?.controls();goalUI?.controls();ai.disabled=true;noAi.disabled=disabled||needsReconciliation||!current||(current.draft.fields['model.reference'].value==="NONE"&&current.draft.fields['model.reference'].confirmation==='CONFIRMED');}
  function showPresentation(){
   target.dataset.configurationState=step;target.dataset.configurationPresentation=presentation;
   for(const b of steps.querySelectorAll<HTMLButtonElement>("button")){if(b.dataset.step===step)b.setAttribute("aria-current","step");else b.removeAttribute("aria-current");}
   introHeading.textContent=stepLabels[step]!;
   intro.textContent=step==="entry"?"Ein geschützter Arbeitsplatz, ein Entwurf. Die folgenden Schritte verwenden dieselbe bestätigte Quelle; Zurückgehen speichert nichts und verliert Ihre offene Eingabe nicht."
    :step==="profile"?"Profil und Grenzen kommen vom bestehenden geprüften Adapter. Die folgenden Werte sind Entwurfsparameter, keine editierbaren Identitäten oder neuen Zugangsrechte."
    :step==="model"?"Modelllos nutzbar. Eine synthetische Referenz ist keine echte KI-Verbindung. Produktanbieter, Zugriff und Kostenfreigabe sind hier nicht qualifiziert; kein automatischer Aufruf und kein Langzeittoken im Browser."
    :step==="result"?"Plan und Ergebnis beruhen ausschließlich auf dem zuletzt unabhängig gelesenen Entwurf. Ein vollständiger Entwurf aktiviert keinen Agenten und bestätigt keine fachliche Wirkung."
    :"Eine notwendige Frage nach der anderen oder dieselben Felder als Formular bearbeiten. Erst ausdrücklich bestätigen, danach unabhängig vom zuständigen Backend erneut lesen.";
   conversation.setAttribute("aria-pressed",String(presentation==="conversation"));formView.setAttribute("aria-pressed",String(presentation==="form"));
   presentationNote.textContent=presentation==="conversation"?"Modellloses Konfigurationsgespräch: strukturierte Frage des bestehenden Entwurfsowners, keine KI-Antwort und kein Modellaufruf. Die bestätigte Antwort wird aus demselben nativen Entwurf gelesen.":"Formularansicht desselben geschützten Entwurfs. Ansichtswechsel speichern oder aktivieren nichts.";
   presentationControls.hidden=step!=="configuration";presentationNote.hidden=step!=="configuration";editor.hidden=step!=="configuration";connection.hidden=step!=="model";result.hidden=step!=="result";
   // Transfer is a separate result-step projection, not a free-text conversation input.
   // Keep the same ephemeral node/owner/flight guard when detached; no new authority.
   if(transferUI){if(step==="result")result.append(transferUI.root);else transferUI.root.remove();}
   if(goalUI)goalUI.root.hidden=step!=="profile";
   body.hidden=step==="entry"||step==="result"||step==="configuration"&&presentation==="conversation";
   for(const group of body.querySelectorAll<HTMLElement>('[data-configuration-group]'))group.hidden=step==="profile"?!["context","goal","runtime"].includes(group.dataset.configurationGroup!):step==="model"?!["model","access"].includes(group.dataset.configurationGroup!):false;
  }
  async function request(method:"GET"|"POST",payload?:unknown,path=browserWorkspaceStringValuesV1[123] as string){
   const fresh=await fetch(base+browserWorkspaceStringValuesV1[18],{credentials:"same-origin",cache:"no-store",signal});const binding=fresh.status===200?await fresh.json()as BrowserContextV1:null;
   if(!active()||binding?.sessionId!==captured.sessionId||binding.tenantId!==captured.tenantId)return{status:401,value:null};
   const response=await fetch(base+path,{method,credentials:"same-origin",cache:"no-store",signal,...(method==="POST"?{headers:{"content-type":"application/json","x-pan563-context":captured.sessionId},body:JSON.stringify(payload)}:{})});const value=await response.json()as Readback&{error?:string};
   const after=await fetch(base+browserWorkspaceStringValuesV1[18],{credentials:"same-origin",cache:"no-store",signal});const afterBinding=after.status===200?await after.json()as BrowserContextV1:null;
   if(!active()||afterBinding?.sessionId!==captured.sessionId||afterBinding.tenantId!==captured.tenantId)return{status:401,value:null};return{status:response.status,value};
  }
  function accepted(raw:unknown):raw is Readback{const value=raw as Readback|null;
   return !!value&&value.schemaVersion==="pansphaira.agent-configuration/readback/v1"&&value.activationAuthorized===false&&Number.isSafeInteger(value.revision)&&value.revision>=0&&value.draft?.schemaVersion==="pansphaira.agent-configuration/draft/v1"
    &&value.draft.adapterVersion==="pan441-pan529/v1"&&value.draft.policyDigest===value.policyDigest&&Array.isArray(value.questions)&&Array.isArray(value.unresolvedFields)
    &&value.authorityContext?.source==="PROTECTED_BACKEND"&&value.authorityContext.tenantId===captured.tenantId&&value.authorityContext.executionAuthorityGranted===false&&value.authorityContext.draftSaveAllowed===true
    &&!!value.definitions&&Object.values(value.definitions).every(d=>d.schemaVersion==="pansphaira.agent-configuration/field/v1"&&d.version==="1.0.0")
    &&JSON.stringify(Object.keys(value.definitions).sort())===JSON.stringify(Object.keys(value.draft.fields).sort());
  }
  function failure(code:number,error?:string){
   if([401,403].includes(code)){current=null;goalUI?.clear();body.replaceChildren();editor.replaceChildren();summary.replaceChildren();result.replaceChildren();editing=null;}
   if(code===409)needsReconciliation=true;
   state(code===409?"CONFLICT":[401,403].includes(code)?"DENIED":"ERROR",code===409&&error==="CONFIGURATION_POLICY_CHANGED_REJECT_REQUIRES_RECONFIRMATION"?"Profil oder Runtimevorlage nicht mehr kompatibel. Ursprünglicher Entwurf bleibt erhalten; geprüfte Migration oder erneute Owner-Bestätigung erforderlich.":code===409?"Revisionskonflikt: Ein anderer Tab hat den Entwurf geändert. Eingabe nicht überschrieben. Aktuellen Entwurf ausdrücklich neu laden und prüfen.":[401,403].includes(code)?"Zugriff verweigert: Session oder Kontextbindung nicht mehr gültig. Kein erfolgreicher Speichervorgang bestätigt.":"Konfigurationsbackend nicht verfügbar oder Eingabe abgelehnt. Kein erfolgreicher Speichernachweis. "+(error??""));
   if(active()){step="configuration";showPresentation();status.focus();editor.querySelector<HTMLElement>('input,select')?.focus();}
  }
  async function save(field:AgentConfigurationFieldV1,value:AgentConfigurationValueV1|null,confirmation:"CONFIRM"|"UNKNOWN"){
   if(!current||busy||transferInFlight||goalInFlight||needsReconciliation||!active())return;busy=true;saveInFlight=true;controls(true);state("SAVING","Entwurf wird mit erwarteter Revision gespeichert und anschließend erneut gelesen …");
   try{const result=await request("POST",{schemaVersion:"pansphaira.agent-configuration/answers/v1",expectedRevision:current.revision,answers:[{field,value,confirmation}]});if(!active())return;
    if(result.status>=500)throw Error("Serverantwort bestätigt den Speicherausgang nicht");if(result.status!==200){failure(result.status,result.value?.error);return;}if(!accepted(result.value))throw Error("Ungültiger Zielreadback");
    const readback=await request("GET");if(!active())return;if(readback.status!==200||!accepted(readback.value)||readback.value.revision!==result.value.revision||JSON.stringify(readback.value.draft)!==JSON.stringify(result.value.draft))throw Error("Persistierter Zielreadback stimmt nicht überein");
    current=readback.value;dirty=false;editing=null;show();state("PERSISTED","Entwurf gespeichert und identisch vom zuständigen Backend erneut gelesen. Revision "+current.revision+".");editor.querySelector<HTMLElement>('input,select')?.focus();
   }catch(e){if(active()){needsReconciliation=true;state(browserWorkspaceStringValuesV1[51] as string,"Speicherausgang unklar: Server kann bereits gespeichert haben. Keine automatische Wiederholung. Aktuellen Entwurf ausdrücklich neu laden und abgleichen. "+(e instanceof Error?e.message:""));status.focus();}}
   finally{busy=false;saveInFlight=false;if(active()){controls(false);if(target.dataset.outcome==="ERROR")editor.querySelector<HTMLElement>('input:not(:disabled),select:not(:disabled)')?.focus();}}
  }
  function provenance(field:AgentConfigurationFieldV1){const f=current!.draft.fields[field];return f.source==="PROFILE_TEMPLATE"?"Geprüftes Profil / Runtimevorlage":f.source==="SESSION_USER"?"Antwort des angemeldeten Nutzers":f.confirmation==="STALE"?"Untrusted Importvorschlag — noch nicht bestätigt":"Noch ungeklärt";}
  function edit(field:AgentConfigurationFieldV1,question=false){
   if(!current)return;if(dirty){state("UNCONFIRMED_INPUT","Ihre noch unbestätigte Eingabe bleibt erhalten. Erst bestätigen oder ausdrücklich verwerfen; keine Antwort durch eine andere Karte ersetzt.");editor.querySelector<HTMLElement>('input,select')?.focus();return;}
   step="configuration";editing=field;editor.replaceChildren();showPresentation();
   const d=current.definitions[field],existing=current.draft.fields[field],q=current.questions.find(q=>q.field===field);
   const title=text("h2",d.label);title.id="configuration-question";
   const why=text("p","Warum diese Frage: "+(q?.reason==="DEPENDENCY_CHANGED"?"Eine bestätigte Abhängigkeit wurde geändert; erneut prüfen.":q?.reason==="CONTRADICTION"?"Widersprüchliche Antworten brauchen eine ausdrückliche Klärung.":q?"Der notwendige Wert ist noch unbekannt oder ungeklärt.":"Dieses bestätigte Feld wird ausdrücklich bearbeitet; abhängige Antworten werden vom Server neu geprüft."));why.dataset.questionReason="";
   const source=text("p","Quelle des Vorschlags: "+provenance(field)+". Bearbeitbar als Entwurfswert innerhalb der angezeigten zulässigen Auswahl. Grenzen kommen ausschließlich vom bestehenden Adapter; Herkunft und Bestätigung setzt der Server.");source.dataset.questionSource="";
   const detail=text("p",d.help["de-DE"]+(question?" Nur diese notwendige Antwort ist aktuell ungelöst.":" Eine Änderung macht nur abhängige Antworten und Prüfungen ungültig."));
   const form=document.createElement("form");form.setAttribute("aria-labelledby",title.id);let readValue:()=>AgentConfigurationValueV1|null;
   if(d.type==="SET"){const set=document.createElement("fieldset");set.append(text("legend",d.label));const inputs:HTMLInputElement[]=[];for(const value of d.allowedValues){const label=document.createElement("label"),input=document.createElement("input");input.type="checkbox";input.value=String(value);input.checked=Array.isArray(existing.value)&&existing.value.includes(String(value));inputs.push(input);label.append(input,document.createTextNode(displayValue(value)));set.append(label);}form.append(set);readValue=()=>inputs.filter(i=>i.checked).map(i=>i.value);}
   else if(d.type==="INTEGER"){const label=text("label",d.label),input=document.createElement("input");input.type="number";input.min=String(d.allowedValues[0]);input.max=String(d.allowedValues[1]);input.step="1";input.required=true;input.value=typeof existing.value==="number"?String(existing.value):"";label.append(input);form.append(label);readValue=()=>Number(input.value);}
   else{const label=text("label",d.label),select=document.createElement("select");select.required=true;const empty=document.createElement("option");empty.value="";empty.textContent="Bitte ausdrücklich auswählen — kein stiller Default";select.append(empty);for(const value of d.allowedValues){const option=document.createElement("option");option.value=JSON.stringify(value);option.textContent=value===null?"Keine Secretreferenz erforderlich":displayValue(value);select.append(option);}if(existing.confirmation!=="UNKNOWN"&&existing.confirmation!=="CONTRADICTED")select.value=JSON.stringify(existing.value);select.id="configuration-value";label.setAttribute("for",select.id);form.append(label,select);readValue=()=>JSON.parse(select.value)as AgentConfigurationValueV1|null;}
   form.addEventListener("input",()=>{dirty=true;},{signal});form.addEventListener("change",()=>{dirty=true;},{signal});
   const submit=button("Bestätigen und Entwurf speichern");submit.type="submit";const unknown=button("Als unbekannt speichern"),later=button("Später beantworten — Eingabe behalten");
   form.append(submit,unknown,later);form.addEventListener("submit",e=>{e.preventDefault();if(busy||transferInFlight||goalInFlight||needsReconciliation)return;try{if(!form.checkValidity())throw Error("Bitte einen zulässigen Wert ausdrücklich auswählen.");const value=readValue();if(Array.isArray(value)&&value.length===0)throw Error("Mindestens einen zulässigen Wert auswählen.");void save(field,value,"CONFIRM");}catch{state("VALIDATION_ERROR","Eingabe für „"+d.label+"“ unvollständig oder ungültig. Kein Request gespeichert; die betroffene Karte bleibt erhalten.");const input=form.querySelector<HTMLElement>('input,select');input?.setAttribute('aria-invalid','true');input?.focus();}},{signal});
   unknown.addEventListener("click",()=>{void save(field,null,"UNKNOWN");},{signal});later.addEventListener("click",()=>{state("DEFERRED","Diese Frage bleibt ausdrücklich offen. Eingabe erhalten; nichts gespeichert oder still als bestätigt angenommen.");form.querySelector<HTMLElement>('input,select')?.focus();},{signal});
   editor.append(title,why,source,detail,form);
  }
  function show(){
   if(!current)return;body.replaceChildren();editor.replaceChildren();summary.replaceChildren();result.replaceChildren();editing=null;
   summary.append(text("h2","Entwurfszusammenfassung"),text("p","Profil: "+current.profileId+" · Revision "+current.revision),text("p","Ziel: "+displayValue(current.draft.fields['goal.purpose'].value)),text("p","Modell: "+displayValue(current.draft.fields['model.reference'].value)),text("p","Speicherstand: "+(current.persisted?"unabhängig gelesen":"noch nicht gespeichert")+" · Offene Pflichtwerte: "+current.unresolvedFields.length),text("p","Keine Aktivierung oder fachliche Wirkung autorisiert."));
   result.append(text("h2","Plan und Ergebnis — noch keine Aktivierung"),text("p",current.outcome==="RESOLVED"?"Die bestätigte normalisierte Konfiguration ist vollständig. Sie wurde gespeichert oder vom zuständigen Owner gelesen; keine Ausführung freigegeben.":"Plan noch unvollständig. "+current.unresolvedFields.length+" Pflichtwerte sind offen; nur eine serverseitig bestätigte vollständige Konfiguration kann als Entwurfsergebnis gelten."));
   const resultDetails=document.createElement("details");resultDetails.append(text("summary","Technische Details"),text("pre",JSON.stringify({configurationDigest:current.configurationDigest,revision:current.revision,activationAuthorized:current.activationAuthorized},null,2)));result.append(resultDetails);if(applicationUI){applicationUI.reset();result.append(applicationUI.root);}if(transferUI){transferUI.acceptedDraft();result.append(transferUI.root);}
   body.append(text("h2","Aktuelle Parameter und Herkunft"),text("p","Profil: "+current.profileId+" · Schema v1 · Adapter pan441-pan529/v1 · Revision "+current.revision));
   const groups=new Map<string,HTMLUListElement>();for(const field of Object.keys(current.definitions)as AgentConfigurationFieldV1[]){const f=current.draft.fields[field],d=current.definitions[field],li=document.createElement("li");let list=groups.get(d.group);if(!list){const section=document.createElement("details");section.className="configuration-group";section.dataset.configurationGroup=d.group;section.open=["context","goal"].includes(d.group);section.append(text("summary",groupLabels[d.group]??d.group));list=document.createElement("ul");list.className="configuration-parameters";section.append(list);body.append(section);groups.set(d.group,list);}
    const confirmation={CONFIRMED:"Bestätigt",UNKNOWN:"Unbekannt",STALE:"Erneut bestätigen",CONTRADICTED:"Widersprüchlich"}[f.confirmation],validation={CURRENT:"Aktuell",UNKNOWN:"Offen",STALE:"Erneut prüfen"}[f.validation.status];const applicable=d.requiredWhen!=="SYNTHETIC_MODEL"||current.draft.fields['model.reference'].value==="synthetic-bounded/v1";
    li.append(text("strong",d.label),text("p",applicable?displayValue(f.value):"Ohne Modell nicht anwendbar — ursprünglicher Wert bleibt im Entwurf erhalten"),text("p","Quelle: "+provenance(field)+" · "+confirmation+" · Prüfung: "+validation));const technical=document.createElement("details");technical.append(text("summary","Technische Details"),text("pre",JSON.stringify({field,definition:d,state:f},null,2)));li.append(technical);
    const b=button("Bearbeiten: "+d.label);b.addEventListener("click",()=>{edit(field);editor.querySelector<HTMLElement>('input,select')?.focus();},{signal});li.append(b);list.append(li);
   }
   if(current.questions.length)edit(current.questions[0]!.field,true);else editor.append(text("h2","Keine fehlenden Pflichtfragen"),text("p","Die bestätigte normalisierte Konfiguration ist vollständig. Konfigurationsdigest: "+current.configurationDigest));showPresentation();
  }
  async function load(){
   if(busy||transferInFlight||goalInFlight)return;busy=true;controls(true);state("LOADING","Versionierter Entwurf wird vom zuständigen Backend gelesen …");
   try{const result=await request("GET");if(!active())return;if(result.status!==200){failure(result.status,result.value?.error);return;}if(!accepted(result.value))throw Error("Ungültiger Backendvertrag");current=result.value;needsReconciliation=false;dirty=false;show();state(current.persisted?"READBACK_RECEIVED":"EMPTY",current.persisted?"Gespeicherten Entwurf gelesen. Revision "+current.revision+".":"Noch kein gespeicherter Entwurf. Geprüftes begrenztes Profil vorbelegt; ungelöste Pflichtwerte bleiben ausdrücklich unbekannt.");if(goalUI)await goalUI.load();}catch(e){if(active())failure(503,e instanceof Error?e.message:"");}finally{busy=false;if(active())controls(false);}
  }
  reload.addEventListener("click",()=>{if((dirty||goalUI?.isDirty())&&!needsReconciliation){state("UNCONFIRMED_INPUT","Offene Eingabe erhalten. Erst bestätigen oder ausdrücklich verwerfen; aktueller Entwurf nicht über eine offene Antwort geladen.");return;}void load();},{signal});await load();
 }};
}
