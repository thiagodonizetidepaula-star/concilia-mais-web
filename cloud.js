/* Concilia+ Web: sincronização de workspace com RLS e controle de revisão.
   Chave publishable é pública e depende do login e das políticas RLS. */
'use strict';
(function(){
 const url='https://csnvudadurtzhudlplij.supabase.co';
 const key='sb_publishable_Ujaf2hLpLsVZdJsqk6mixg_Rhrld87L';
 let client=null, revision=null, queue=Promise.resolve(), user=null;
 function connect(){
  if(!window.supabase?.createClient)throw Error('Biblioteca Supabase indisponível. Atualize a página e verifique a internet.');
  if(!client)client=window.supabase.createClient(url,key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  return client;
 }
 function setUser(u){user=u||null;if(!user)revision=null;}
 async function signIn(email,password){const {data,error}=await connect().auth.signInWithPassword({email,password});if(error)throw error;setUser(data.user);return data.user;}
 async function signUp(email,password){const {data,error}=await connect().auth.signUp({email,password,options:{emailRedirectTo:'https://concilia-mais-web.onrender.com/'}});if(error)throw error;return data;}
 async function signOut(){const {error}=await connect().auth.signOut();if(error)throw error;setUser(null);}
 async function session(){const {data,error}=await connect().auth.getUser();if(error||!data?.user){setUser(null);return null;}setUser(data.user);return user;}
 function identity(){return user?.email||'';}
 async function fetchWorkspace(){
  if(!user)throw Error('Entre na sua conta antes de acessar a nuvem.');
  const {data,error}=await connect().from('user_workspaces').select('payload,revision').eq('user_id',user.id).maybeSingle();
  if(error)throw error;
  revision=data?.revision??0;
  return data?.payload||null;
 }
 async function saveWorkspace(payload){
  if(!user)throw Error('Entre na sua conta antes de salvar.');
  if(revision===null)throw Error('Antes de salvar, verifique a nuvem ou faça a migração inicial.');
  const {data,error}=await connect().rpc('save_user_workspace',{p_payload:payload,p_expected_revision:revision});
  if(error)throw error;
  revision=Number(data);
  return revision;
 }
 function serializedSave(payload){queue=queue.catch(()=>{}).then(()=>saveWorkspace(payload));return queue;}
 async function waitWrites(){await queue;}
 window.ConciliaCloud={connect,signIn,signUp,signOut,session,identity,fetchWorkspace,saveWorkspace,serializedSave,waitWrites,revision:()=>revision,authenticated:()=>!!user};
})();
