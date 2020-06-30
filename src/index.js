const core = require('@actions/core');
const github = require('@actions/github');
const dependencies = require('./utils/install-dependencies.js');
const sfdx = require('./utils/sfdx.js');

try {
  const payload = JSON.stringify(github.context.payload, undefined, 2)
  core.debug("=== index.js ===");
  core.debug(`The event payload: ${payload}`);
  //dependencies.install();
  

  sfdx.login(
    {
      certificatePath : "devops/server.key.enc", 
      decryptionKey : "8CB2237D0679CA88DB6464EAC60DA96345513964D4F5EC90C4B6A22B810B337F", 
      decryptionIV : "E1786DC9EC34036F6DA24067A92E39CA"
    }, 
    {
      clientId : "3MVG99E3Ry5mh4zo9bk2v8pC2ros2NQz1pjy8v2VdlqBfQWKtT2c1uRmw92WL1MzPdQISSlx8CFoOXJq7J9Lq",
      orgType : "sandbox",
      username : "manuel.cortes@bancoestado.cl.dev"
    }
  );

 var deploy = {
  defaultClassesPath : 'force-app/main/default/classes',
  defaultDefault : 'ClaseDePrueba',
  manifestToDeploy : 'manifest/releases/REL_01/package_01.xml,manifest/releases/REL_01/package_02.xml',
  checkout : true
 };
 //sfdx force:auth:jwt:grant --instanceurl https://test.salesforce.com --clientid 3MVG99E3Ry5mh4zo9bk2v8pC2ros2NQz1pjy8v2VdlqBfQWKtT2c1uRmw92WL1MzPdQISSlx8CFoOXJq7J9Lq --jwtkeyfile server.key --username manuel.cortes@bancoestado.cl.dev --setalias sfdc
 //sfdx force:source:deploy --wait 10 --manifest manifest/releases/REL_01/package_01.xml --targetusername sfdc --testlevel RunLocalTests --json --testlevel RunSpecifiedTests --runtests BE_CreateLeadLayoutSelectorTest,CA_EnvioActualizadoServiceTest

 sfdx.deploy(deploy);
  

 console.log("las clases son : "  + classes);
} catch (error) {
  core.setFailed(error.message);
}

