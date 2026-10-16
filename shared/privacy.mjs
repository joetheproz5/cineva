// This is a consent preference, not an authentication credential.
// Optional metrics fail closed when the preference or a browser signal is absent.
export function optionalAnalyticsAllowed(request){
  if(request.headers.get('DNT')==='1'||request.headers.get('Sec-GPC')==='1')return false;
  const choices=(request.headers.get('Cookie')||'').split(';').map(part=>part.trim()).filter(part=>part.startsWith('seven_optional_analytics='));
  return choices.length===1&&choices[0]==='seven_optional_analytics=allow';
}
