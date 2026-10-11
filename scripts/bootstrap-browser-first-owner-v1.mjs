#!/usr/bin/env node
import {readFileSync,fstatSync,writeSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {dirname,resolve} from 'node:path';
import {createProtectedBrowserBootstrapV1} from '../src/pan562/native-browser-bootstrap.mjs';
import {readProtectedOwnerSecretFileV1} from '../src/pan527/origin-session-adapter.mjs';
const sourceRoot=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const flags=new Map([['--root','root'],['--origin','origin'],['--identity-file','identityPath'],['--tls-key','keyPath'],['--tls-cert','certPath'],['--proof-fd','proofFd'],['--proof-ttl-ms','proofTtlMs'],['--session-ttl-ms','sessionTtlMs']]);
let app,closing=false;
async function close(){if(closing)return;closing=true;await app?.close();if(process.connected)process.disconnect();}
try{
 const opts={};let optIn=false,resume=false;
 const args=process.argv.slice(2);
 for(let i=0;i<args.length;i++){
  if(args[i]==='--opt-in-existing-owner'){if(optIn)throw Error('BOOTSTRAP_CLI_ARGUMENTS_DENIED');optIn=true;continue;}
  if(args[i]==='--resume-grant'){if(resume)throw Error('BOOTSTRAP_CLI_ARGUMENTS_DENIED');resume=true;continue;}
  const key=flags.get(args[i]);if(!key||Object.hasOwn(opts,key)||!args[i+1]||args[i+1].startsWith('--'))throw Error('BOOTSTRAP_CLI_ARGUMENTS_DENIED');opts[key]=args[++i];
 }
 if(!optIn||['root','origin','identityPath','keyPath','certPath'].some(k=>!Object.hasOwn(opts,k)))throw Error('BOOTSTRAP_CLI_ARGUMENTS_DENIED');
 let fd=null;if(opts.proofFd!==undefined){if(!/^[1-9][0-9]{0,2}$/.test(opts.proofFd)||Number(opts.proofFd)<3)throw Error('BOOTSTRAP_PRIVATE_CHANNEL_DENIED');fd=Number(opts.proofFd);const stat=fstatSync(fd);if((!stat.isFIFO()&&!stat.isSocket())||stat.uid!==process.getuid())throw Error('BOOTSTRAP_PRIVATE_CHANNEL_DENIED');}
 const identity=JSON.parse(readProtectedOwnerSecretFileV1(resolve(opts.identityPath)).toString('utf8'));
 if(identity.runtime?.name!=='node'||identity.runtime.version!==process.versions.node||process.platform!=='linux'||process.arch!=='x64'||identity.architecture!=='x86_64')throw Error('BOOTSTRAP_SUPPORTED_RUNTIME_DENIED');
 const git=(...args)=>execFileSync('git',['-C',sourceRoot,...args],{encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();
 if(identity.sourceCommit!==git('rev-parse','HEAD')||identity.sourceTree!==git('rev-parse','HEAD^{tree}'))throw Error('BOOTSTRAP_SOURCE_BINDING_DENIED');
 app=createProtectedBrowserBootstrapV1({optIn:true,origin:opts.origin,tls:{keyPath:resolve(opts.keyPath),certPath:resolve(opts.certPath)},identity,root:resolve(opts.root),subjectId:'owner:local-demo',proofTtlMs:opts.proofTtlMs===undefined?60000:Number(opts.proofTtlMs),sessionTtlMs:opts.sessionTtlMs===undefined?1800000:Number(opts.sessionTtlMs)});
 await app.listen();
 const ready={schemaVersion:'pansphaira.browser-bootstrap/launch-readback/v1',browserAddress:opts.origin+app.browserPath,state:app.read().state,runtimeObserved:{platform:process.platform,architecture:process.arch,nodeVersion:process.versions.node},identityIsBindingNotDockerReadiness:true,noAgentOrBusinessTerminalParameters:true};
 const privateSend=grant=>{const packet={operation:'PRIVATE_OWNER_GRANT',purpose:app.read().state==='INITIALIZED'?'RESUME':'FIRST_OWNER',grant};if(process.send)process.send(packet);else if(fd!==null)writeSync(fd,JSON.stringify(packet)+'\n');else throw Error('BOOTSTRAP_PRIVATE_CHANNEL_REQUIRED');};
 if(process.send||fd!==null){if(resume)privateSend(app.issueResume());else if(app.read().state!=='INITIALIZED')privateSend(app.issueFirst());}
 process.stdout.write(JSON.stringify(ready)+'\n');if(process.send)process.send({operation:'READY',readback:ready});
 process.on('message',async message=>{try{if(!message||!['ISSUE_FIRST','ISSUE_RESUME','READ','STOP'].includes(message.operation)||Object.keys(message).length!==1)throw Error('BOOTSTRAP_PRIVATE_OPERATION_DENIED');if(message.operation==='ISSUE_FIRST')privateSend(app.issueFirst());else if(message.operation==='ISSUE_RESUME')privateSend(app.issueResume());else if(message.operation==='READ')process.send?.({operation:'READBACK',state:app.read().state});else{await close();process.exitCode=0;}}catch(error){process.send?.({operation:'DENIED',code:/^[A-Z0-9_]+$/.test(error.message)?error.message:'BOOTSTRAP_OWNER_OPERATION_DENIED'});}});
 process.on('SIGTERM',()=>{void close();});process.on('SIGINT',()=>{void close();});process.on('disconnect',()=>{void close();});
}catch(error){await close();const code=/^[A-Z0-9_]+$/.test(error?.message)?error.message:'BOOTSTRAP_START_FAILED';process.stderr.write('HELD: '+code+'\n');process.exitCode=2;}
