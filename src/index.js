const core = require('@actions/core');
const github = require('@actions/github');
const dependencies = require('./utils/install-dependencies.js');
const sfdx = require('./utils/sfdx.js');

try {
  const payload = JSON.stringify(github.context.payload, undefined, 2)
  core.debug("=== index.js ===");
  core.debug(`The event payload: ${payload}`);
  //dependencies.install();
  

 
 
 var classes = sfdx.getApexTestClass('manifest/releases/REL_01/package_02.xml', 'force-app/main/default/classes', 'ClaseSumadre');
 console.log("las clases son : "  + classes);
} catch (error) {
  core.setFailed(error.message);
}

