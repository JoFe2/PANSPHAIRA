// Binding only: one existing PAN548 task and its existing PAN529 reservation.
// No engine, table, caller signer, model budget or execution capability.
import {createHash} from 'node:crypto';
import {canonicalJson} from '../../dist/packages/contracts/src/canonical-json.js';
const digest=v=>createHash('sha256').update(canonicalJson(v)).digest('hex');
export const modelFreeUiBudgetOperationV1=id=>{if(typeof id!=='string'||!/^invocation:[a-f0-9]{32}$/.test(id))throw Error('UI_TASK_BUDGET_ID_DENIED');return 'operation:ui-invocation-'+id.slice(11);};
export function modelFreeUiBudgetBindingV1(id,writerEpoch){
 if(!Number.isSafeInteger(writerEpoch)||writerEpoch<1)throw Error('UI_TASK_BUDGET_EPOCH_DENIED');
 return Object.freeze({schemaVersion:'pansphaira.workspace-ui-task/budget-binding/v1',operationId:modelFreeUiBudgetOperationV1(id),writerEpoch,modelUnits:0,runtimeUnits:1});
}
export function modelFreeUiTaskReservationV1(row){
 const original=JSON.parse(row.original_command);if(digest(original)!==row.request_digest)throw Error('UI_TASK_BUDGET_TASK_BYTES_DENIED');
 if(original.schemaVersion==='pansphaira.workspace-invocation/effect-command/v1')return null;
 if(original.schemaVersion!=='pansphaira.workspace-invocation/effect-command/v2'||original.invocationId!==row.command_id||typeof row.principal_digest!=='string'||!/^[a-f0-9]{64}$/.test(row.principal_digest))throw Error('UI_TASK_BUDGET_TASK_SCHEMA_DENIED');
 const expected=modelFreeUiBudgetBindingV1(row.command_id,original.budgetBinding?.writerEpoch);
 if(canonicalJson(original.budgetBinding)!==canonicalJson(expected))throw Error('UI_TASK_BUDGET_BINDING_DENIED');
 return Object.freeze({operationId:expected.operationId,requestDigest:digest({schemaVersion:'pansphaira.workspace-ui-task/budget-request/v1',taskId:row.command_id,taskRequestDigest:row.request_digest,principalDigest:row.principal_digest}),modelUnits:0,runtimeUnits:1,writerEpoch:expected.writerEpoch});
}
export function readModelFreeUiTaskBudgetV1(db,row,currentEpoch){
 const binding=modelFreeUiTaskReservationV1(row);if(binding===null)return Object.freeze({available:false,reason:'LEGACY_TASK_HAS_NO_LINKED_NATIVE_BUDGET'});
 if(binding.writerEpoch>currentEpoch)throw Error('UI_TASK_BUDGET_EPOCH_DENIED');
 const r=db.prepare('SELECT operation_id,request_digest,model_units,runtime_units,state,model_consumed,runtime_consumed,result_json FROM reservations WHERE operation_id=?').get(binding.operationId);
 if(!r||r.request_digest!==binding.requestDigest||r.model_units!==0||r.runtime_units!==1||r.model_consumed!==0||r.runtime_consumed!==(r.state==='SETTLED'?1:0)||!['UNKNOWN_USAGE','SETTLED'].includes(r.state))throw Error('UI_TASK_BUDGET_CUSTODY_DENIED');
 if(row.state==='COMPLETED'&&(r.state!=='SETTLED'||r.result_json!==row.result_json)||row.state!=='COMPLETED'&&r.state==='SETTLED')throw Error('UI_TASK_BUDGET_TASK_STATE_CONFLICT');
 return Object.freeze({available:true,operationId:r.operation_id,requestDigest:r.request_digest,writerEpoch:binding.writerEpoch,state:r.state,modelReservedUnits:r.model_units,runtimeReservedUnits:r.runtime_units,modelConsumedUnits:r.model_consumed,runtimeConsumedUnits:r.runtime_consumed,unit:'COUNT',unconfirmedReservationRetained:r.state==='UNKNOWN_USAGE',model:'NOT_RUN'});
}
