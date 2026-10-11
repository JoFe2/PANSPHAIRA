import {createProtectedSessionAdapterV1,createProtectedFirstPossessionV1} from '../../src/pan527/origin-session-adapter.mjs';
let job,owner;
process.on('message', message => {
 try {
  if (message.operation === 'PREPARE') {
   job=message.job;const sessions=createProtectedSessionAdapterV1(job.sessionOptions);
   owner=createProtectedFirstPossessionV1(sessions,job.ownerOptions);
   process.send({state:'READY',pid:process.pid});
  } else if(message.operation==='CLAIM'&&owner) {
   try {owner.redeem(job.headers,job.body);process.send({state:'REDEEMED',pid:process.pid});}
   catch(error) {process.send({state:'DENIED',code:error.message,pid:process.pid});}
   process.disconnect();
  } else throw Error('OWNED_PROCESS_PROBE_PROTOCOL_DENIED');
 }catch {process.send?.({state:'PROBE_FAILURE',pid:process.pid});process.exitCode=1;process.disconnect();}
});
