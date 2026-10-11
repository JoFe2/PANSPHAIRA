import {mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {nativeFixture527,request527} from '../pan527/helpers.mjs';
import {createProtectedBrowserBootstrapV1} from '../../src/pan562/native-browser-bootstrap.mjs';
export async function bootstrapFixture562({proofTtlMs=60000,sessionTtlMs=60000}={}){
 const tls=await nativeFixture527();await new Promise(resolve=>tls.gateway.server.close(resolve));
 const root=join(tls.root,'fresh-bootstrap-instance');mkdirSync(root,{mode:0o700});
 const options={optIn:true,origin:tls.origin,tls:tls.options.tls,identity:tls.tenants[0].identity,root,subjectId:'owner:local-demo',proofTtlMs,sessionTtlMs};
 let app=createProtectedBrowserBootstrapV1(options);await app.listen();
 const fixture={tls,options,root,get app(){return app;},get sessions(){return app.sessions;},request(path,headers={},method='GET',body){return request527({...tls,gateway:app.gateway},path,headers,method,body);},async restart(){await app.close();app=createProtectedBrowserBootstrapV1(options);await app.listen();},async close(){await app.close();await tls.close();}};
 return fixture;
}
export function claimBody562(f,grant,purpose='FIRST_OWNER'){return{schemaVersion:'pansphaira.workspace-bootstrap/claim/v1',purpose,proof:grant.proof,instanceId:f.sessions.binding.instanceId,identityDigest:f.sessions.binding.identityDigest};}
