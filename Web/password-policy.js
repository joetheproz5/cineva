/* Shared browser/server rules. Never apply new-password rules to existing logins. */
(function(root,factory){const policy=factory();if(typeof module==='object'&&module.exports)module.exports=policy;else root.SEVENPasswordPolicy=policy;})(globalThis,function(){
  const description='Use at least 12 characters. A long, unique passphrase works well.';
  function error(password){if(typeof password!=='string'||[...password].length<12)return description;if(new TextEncoder().encode(password).length>72)return 'Use a password no longer than 72 UTF-8 bytes.';return '';}
  return {error,description};
});
