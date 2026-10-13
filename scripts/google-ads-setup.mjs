/** Explicit post-approval operator tool. Never used by the scheduler or a browser client.
 * --plan is safe without credentials. --connect performs OAuth+vault bootstrap.
 * --preflight refreshes the dedicated credential and validates synthetic data only.
 */
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
export const scopes=['https://www.googleapis.com/auth/adwords','https://www.googleapis.com/auth/datamanager'];
export const callback='http://127.0.0.1:8756/google-ads/callback';
export function validCallbackState(given,expected) {
  const a=Buffer.from(given),b=Buffer.from(expected);return a.length===b.length&&timingSafeEqual(a,b);
}
export function authorizationUrl(clientId,state,verifier) {
  const url=new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.search=new URLSearchParams({client_id:clientId,redirect_uri:callback,response_type:'code',access_type:'offline',prompt:'consent',
    include_granted_scopes:'false',scope:scopes.join(' '),state,code_challenge:createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'S256'}).toString();return url.href;
}
export function setupConfig(env=process.env) {
  const c={actorId:env.SANCTUARY_GOOGLE_ADS_ACTOR_ID,clientId:env.SANCTUARY_GOOGLE_ADS_CLIENT_ID,clientSecret:env.SANCTUARY_GOOGLE_ADS_CLIENT_SECRET,
    vaultId:env.SANCTUARY_GOOGLE_ADS_VAULT_ID,itemId:env.SANCTUARY_GOOGLE_ADS_CREDENTIAL_ITEM_ID,vaultToken:env.SANCTUARY_GOOGLE_ADS_SERVICE_ACCOUNT_TOKEN};
  if(Object.values(c).some(v=>typeof v!=='string'||!v))throw Error('Required dedicated advertising configuration is missing.');
  const binding=createHash('sha256').update(JSON.stringify(c)).digest('hex');
  if(env.SANCTUARY_GOOGLE_ADS_BINDING_SHA256!==binding)throw Error('Credential binding is not pinned.');return {...c,binding};
}
async function json(url,init={}) {
  const r=await fetch(url,{...init,redirect:'error',cache:'no-store',signal:AbortSignal.timeout(20000)});
  if(!r.ok){await r.body?.cancel();throw Error(`Provider returned HTTP ${r.status}. Inspect account diagnostics; payload withheld.`);}
  const text=await r.text();if(text.length>2*1024*1024)throw Error('Response exceeded bound.');return JSON.parse(text);
}
async function boundedVault(operation) {
  let timer;try{return await Promise.race([operation,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Vault outcome uncertain; reconcile before retry.')),15000);})]);}
  finally{clearTimeout(timer);}
}
function validateToken(token) {
  const got=(token.scope??'').split(' ').filter(Boolean).sort();
  if(JSON.stringify(got)!==JSON.stringify([...scopes].sort())||token.token_type!=='Bearer'||!token.access_token)throw Error('Google returned unexpected credential authority.');
}
async function callbackCode(clientId) {
  const state=randomBytes(32).toString('base64url'),verifier=randomBytes(64).toString('base64url');
  return new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{server.close();reject(Error('OAuth callback timed out.'));},5*60000);
    const server=createServer((request,response)=>{
      const url=new URL(request.url??'/',callback),given=url.searchParams.get('state')??'';
      if(url.pathname!=='/google-ads/callback'||!validCallbackState(given,state)){response.writeHead(400,{'Cache-Control':'no-store'});response.end('Invalid callback.');return;}
      clearTimeout(timer);response.writeHead(200,{'Content-Type':'text/plain','Cache-Control':'no-store','Referrer-Policy':'no-referrer'});response.end('Callback received. Check the operator terminal for the verified result.');server.close();
      const code=url.searchParams.get('code');if(!code||url.searchParams.has('error'))reject(Error('Google consent was not completed.'));else resolve({code,verifier});
    });
    server.on('error',error=>{clearTimeout(timer);reject(error);});
    server.listen(8756,'127.0.0.1',()=>process.stdout.write(`Open this Google authorization link after the recorded production/access approval:\n${authorizationUrl(clientId,state,verifier)}\n`));
  });
}
export async function main(args=process.argv.slice(2)) {
  if(args.length!==1||!['--plan','--connect','--preflight'].includes(args[0]))throw Error('Use --plan, --connect or --preflight.');
  if(args[0]==='--plan'){process.stdout.write(`Register a dedicated Google advertising Web OAuth client with redirect ${callback}. Enable Google Ads and Data Manager APIs in the approved Cloud project. Provision a dedicated 1Password API credential item with one concealed, initially empty refresh_token field. Pin the disabled source control and matching credential binding. Then run --connect, followed by --preflight. Neither command enables uploads or changes campaigns.\n`);return;}
  if(process.env.SANCTUARY_GOOGLE_ADS_SETUP_APPROVED!=='true')throw Error('Recorded owner approval is required before executing setup.');
  if(process.env.SANCTUARY_GOOGLE_ADS_UPLOADS_ENABLED==='true'||process.env.SANCTUARY_GOOGLE_ADS_REPORTS_ENABLED==='true')throw Error('Disable application collection and uploads during setup.');
  const config=setupConfig(),url=new URL(process.env.NEXT_PUBLIC_SUPABASE_URL??process.env.SUPABASE_URL??'');
  if(url.protocol!=='https:'||!url.hostname.endsWith('.supabase.co')||url.pathname!=='/')throw Error('Expected approved Supabase origin.');
  const service=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!service)throw Error('Source service credential missing.');
  const rpc=(name,body)=>json(`${url.origin}/rest/v1/rpc/${name}`,{method:'POST',headers:{apikey:service,Authorization:`Bearer ${service}`,'Content-Type':'application/json'},body:JSON.stringify(body)});
  const command=(action,input={},run=null)=>rpc('google_ads_command',{p_actor:config.actorId,p_binding:config.binding,p_action:action,p_run:run,p_input:input});
  const run=await command('begin',{lane:'verify'});
  const require=createRequire(new URL('../apps/portal/package.json',import.meta.url));
  const {createClient,ItemCategory,ItemFieldType}=await import(pathToFileURL(require.resolve('@1password/sdk')).href);
  const client=await boundedVault(createClient({auth:config.vaultToken,integrationName:'Sanctuary Google Ads setup',integrationVersion:'1.0.0'}));
  const item=await boundedVault(client.items.get(config.vaultId,config.itemId)),fields=item.fields.filter(f=>f.id==='refresh_token');
  if(item.id!==config.itemId||item.vaultId!==config.vaultId||item.category!==ItemCategory.ApiCredentials||fields.length!==1||fields[0].fieldType!==ItemFieldType.Concealed)throw Error('Unexpected vault item.');
  let token;
  if(args[0]==='--connect'){
    if(fields[0].value)throw Error('The dedicated credential is already populated. Reconnection needs explicit credential reconciliation.');
    const {code,verifier}=await callbackCode(config.clientId);
    await command('credential_pending',{},run.runId);
    token=await json('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:config.clientId,client_secret:config.clientSecret,redirect_uri:callback,grant_type:'authorization_code',code,code_verifier:verifier})});
  }else{
    if(!fields[0].value)throw Error('Dedicated refresh credential is not connected.');
    await command('credential_pending',{},run.runId);
    token=await json('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:config.clientId,client_secret:config.clientSecret,grant_type:'refresh_token',refresh_token:fields[0].value})});
  }
  validateToken(token);
  if(args[0]==='--connect'&&!token.refresh_token)throw Error('Google did not return a durable refresh credential.');
  if(token.refresh_token&&token.refresh_token!==fields[0].value){
    const saved=await boundedVault(client.items.put({...item,fields:item.fields.map(f=>f.id==='refresh_token'?{...f,value:token.refresh_token}:f)}));
    if(saved.version<=item.version||saved.fields.find(f=>f.id==='refresh_token')?.value!==token.refresh_token)throw Error('Credential write outcome uncertain. Do not retry; reconcile vault and operation.');
  }
  await rpc('google_ads_credential_settled',{p_actor:config.actorId,p_binding:config.binding,p_run:run.runId});
  const headers={Authorization:`Bearer ${token.access_token}`,'Content-Type':'application/json',...(run.managerId?{'login-customer-id':run.managerId}:{})};
  await command('check',{},run.runId);
  const account=await json(`https://googleads.googleapis.com/v25/customers/${run.customerId}/googleAds:search`,{method:'POST',headers,body:JSON.stringify({query:'SELECT customer.id, customer.currency_code, customer.time_zone, customer.conversion_tracking_setting.google_ads_conversion_customer FROM customer'})});
  const customer=account.results?.[0]?.customer;if(account.results?.length!==1||customer.id!==run.customerId)throw Error('Google account binding failed.');
  if(args[0]==='--preflight'){
    if(!run.actionId||customer.conversionTrackingSetting?.googleAdsConversionCustomer!==`customers/${run.conversionCustomerId}`)throw Error('Conversion owner/action must be pinned before validation.');
    await command('check',{},run.runId);
    const action=await json(`https://googleads.googleapis.com/v25/customers/${run.conversionCustomerId}/googleAds:search`,{method:'POST',headers,body:JSON.stringify({query:`SELECT conversion_action.id, conversion_action.type, conversion_action.status, conversion_action.primary_for_goal, conversion_action.counting_type, conversion_action.value_settings.always_use_default_value FROM conversion_action WHERE conversion_action.id = ${run.actionId}`})});
    const a=action.results?.[0]?.conversionAction;if(action.results?.length!==1||a.id!==run.actionId||a.type!=='UPLOAD_CLICKS'||a.status!=='ENABLED'||a.primaryForGoal!==false||a.countingType!=='MANY_PER_CLICK'||a.valueSettings?.alwaysUseDefaultValue!==false)throw Error('Closed Sale action configuration does not match the reporting-only contract.');
    await command('check',{},run.runId);
    await json('https://datamanager.googleapis.com/v1/events:ingest',{method:'POST',headers:{Authorization:`Bearer ${token.access_token}`,'Content-Type':'application/json'},body:JSON.stringify({validateOnly:true,encoding:'HEX',destinations:[{operatingAccount:{accountType:'GOOGLE_ADS',accountId:run.conversionCustomerId},...(run.managerId?{loginAccount:{accountType:'GOOGLE_ADS',accountId:run.managerId}}:{}),productDestinationId:run.actionId}],events:[{transactionId:'sanctuary-preflight-synthetic',eventTimestamp:new Date().toISOString(),eventSource:'OTHER',conversionValue:1,currency:'NZD',consent:{adUserData:'CONSENT_STATUS_UNSPECIFIED',adPersonalization:'CONSENT_DENIED'},userData:{userIdentifiers:[{emailAddress:createHash('sha256').update('synthetic@example.invalid').digest('hex')}]}}]})});
  }
  await command('finish',{},run.runId);
  process.stdout.write(JSON.stringify({outcome:args[0]==='--connect'?'dedicated_credential_connected':'synthetic_validation_passed',customerId:customer.id,conversionOwner:customer.conversionTrackingSetting?.googleAdsConversionCustomer,currency:customer.currencyCode,timezone:customer.timeZone,liveUploadsEnabled:false})+'\n');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(()=>{process.stderr.write('Google setup did not complete. Keep uploads disabled and reconcile the private source operation and dedicated vault item before retrying. Provider payloads and credentials are withheld.\n');process.exitCode=1;});
