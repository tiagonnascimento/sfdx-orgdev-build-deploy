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
  var deploy = {};
  var propertiesPath = core.getInput('deploy_properties_file');
  var properties = {};

  //Load properties
  if(propertiesPath){
    core.info("Loading properties file: " + propertiesPath);
    properties = propertiesReader(propertiesPath);
  }else{
    properties.get = function(){return null};
    core.info("There is not properites file to load.");
  }

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
  
  //Load deploy params
  deploy.defaultSourcePath = core.getInput('default_source_path');
  deploy.defaultTestClass = properties.get('deploy.default_test_class');
  deploy.manifestToDeploy = properties.get('deploy.manifest_to_deploy');
  deploy.checkout = (core.getInput('checkonly') == 'true' )? true : false;

  //const data_factory = core.getInput('data_factory');
  //const destructive_path = core.getInput('destructive_path');
  
  //Login to Org
  sfdx.login(cert,login);

  //Deply/Checkonly to Org
  sfdx.deploy(deploy);
  
} catch (error) {
  core.setFailed(error.message);
}

