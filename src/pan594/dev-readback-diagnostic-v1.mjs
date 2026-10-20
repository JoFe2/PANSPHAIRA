// Fixed trusted developer diagnostic only; never a catalog/effect authority.
// Existing native owner verifies resource bytes before calling this code.
export function createPan594DevReadbackDiagnostic(schema,Ajv2020){
 const start=process.hrtime.bigint(),cpu=process.cpuUsage(),memory=process.memoryUsage();
 const ajv=new Ajv2020({strict:true,allErrors:true,coerceTypes:false,useDefaults:false,removeAdditional:false,ownProperties:true,validateSchema:true});
 const validate=ajv.compile(schema),compile={scope:'AJV_INSTANCE_AND_FIXED_SCHEMA_COMPILE_MODULE_LOAD_EXCLUDED',wallNs:Number(process.hrtime.bigint()-start),cpuMicros:process.cpuUsage(cpu),memoryBefore:memory,memoryAfter:process.memoryUsage()};
 return Object.freeze({compile,readProjection(projection){if(!validate(projection))throw Error('PAN594_FIXED_PROJECTION_SCHEMA_DENIED');return projection;}});
}
