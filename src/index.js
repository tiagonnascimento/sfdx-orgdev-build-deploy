const core = require('@actions/core');
const github = require('@actions/github');
var propertiesReader = require('properties-reader');
const dependencies = require('./utils/install-dependencies.js');
const sfdx = require('./utils/sfdx.js');

try {
  
  core.debug("=== index.js ===");
  const payload = JSON.stringify(github.context.payload, undefined, 2)
  core.debug(`The event payload: ${payload}`);
  
  //Variables declaration
  var cert = {};
  var login = {};

  //Install dependecies  
  dependencies.install();
  
  //Load cert params
  cert.certificatePath = core.getInput('certificate_path');
  cert.decryptionKey = core.getInput('decryption_key');
  cert.decryptionIV = core.getInput('decryption_iv');

  //Load login params
  login.clientId = core.getInput('client_id');
  login.orgType = core.getInput('type');
  login.username = core.getInput('username');

  //Login to Org
  sfdx.login(cert,login);

  const operationType = core.getInput('operation_type');
  switch (operationType){
    case 'deploy':
      const deploy = {};

      //Load deploy params and deploy
      deploy.defaultSourcePath = core.getInput('default_source_path');
      deploy.defaultTestClass = core.getInput('default_test_class');
      deploy.sfdxRootFolder = core.getInput('sfdx_root_folder');
      deploy.destructivePath = core.getInput('destructive_path');
      deploy.dataFactory = core.getInput('data_factory');
      deploy.checkonly = (core.getInput('checkonly') === 'true' )? true : false;
      deploy.ignoreWarnings = (core.getInput('ignore_warnings') === 'false' )? false : true;
      deploy.testlevel = core.getInput('deploy_testlevel');
      deploy.deployWaitTime = core.getInput('deploy_wait_time') || '60'; // Default wait time is 60 minutes
      deploy.username = 'sfdc';
      deploy.sandbox = false;
      deploy.packageFolder = core.getInput('package_folder');
      deploy.outputStdout = (core.getInput('output_stdout') === 'false' )? false : true;
      sfdx.deployer(deploy);

      if (core.getInput('sandbox_name')) {
        //Authenticate in sandbox
        const sandboxArgs = {};
        sandboxArgs.sandboxCreationType = core.getInput('sandbox_creation_type') || 'clone';
        sandboxArgs.sandboxName = core.getInput('sandbox_name');
        sandboxArgs.sourceSandboxName = core.getInput('source_sandbox_name') || 'masterdev';
        sandboxArgs.deployInProd = !deploy.checkonly;
        deploy.username = sfdx.authInSandbox(sandboxArgs);

        //Deploy in sandbox or delete if it was deploy in prod
        if (deploy.checkonly) { 
          deploy.sandbox = true;
          sfdx.deployer(deploy);
        } else if (deploy.username != undefined) {
          sfdx.deleteSandbox(deploy.username);
        }
      }

      break;
    case 'retrieve':
      const retrieveArgs = {};
      retrieveArgs.manifestToRetrieve = core.getInput('manifest_path');
      retrieveArgs.sfdxRootFolder = core.getInput('sfdx_root_folder');
      retrieveArgs.deployWaitTime = core.getInput('deploy_wait_time') || '60'; // Default wait time is 60 minutes
      sfdx.retrieve(retrieveArgs);
      break;
    case 'dumpChanges':
      const dumpChangesArgs = {};
      dumpChangesArgs.sfdxRootFolder = core.getInput('sfdx_root_folder');
      sfdx.dumpChanges(dumpChangesArgs);
      break;
    case 'create-sandbox': 
      const createArgs = {};
      createArgs.sandboxName = core.getInput('sandbox_name');
      sfdx.createSandbox(createArgs); 
      break;
    case 'run-tests':
      const testArgs = {};
      testArgs.deployWaitTime = core.getInput('deploy_wait_time') || '60';
      testArgs.username = 'sfdc';
      testArgs.testsToRun = core.getInput('tests_to_run') || null;
      testArgs.outputStdout = (core.getInput('output_stdout') === 'false' )? false : true;
      sfdx.runTests(testArgs);
      break;
    default:
      core.setFailed(`Unexpected operation: ${operationType}. Accepted values: deploy,retrieve`);
  }
} catch (error) {
  core.setFailed(error.message);
}