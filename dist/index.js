module.exports =
/******/ (() => { // webpackBootstrap
/******/ 	var __webpack_modules__ = ({

/***/ 920:
/***/ ((__unused_webpack_module, __unused_webpack_exports, __nccwpck_require__) => {

const core = __nccwpck_require__(254);
const github = __nccwpck_require__(388);
var propertiesReader = __nccwpck_require__(355);
const dependencies = __nccwpck_require__(826);
const sfdx = __nccwpck_require__(626);

try {
  
  core.debug("=== index.js ===");
  const payload = JSON.stringify(github.context.payload, undefined, 2)
  core.debug(`The event payload: ${payload}`);
  
  //Variables declaration
  var cert = {};
  var login = {};
  var deploy = {};

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
  deploy.defaultTestClass = core.getInput('default_test_class');
  deploy.manifestToDeploy = core.getInput('manifest_path');
  deploy.destructivePath = core.getInput('destructive_path');
  deploy.dataFactory = core.getInput('data_factory');
  deploy.checkonly = (core.getInput('checkonly') === 'true' )? true : false;
  deploy.testlevel = core.getInput('deploy_testlevel');
  deploy.deployWaitTime = core.getInput('deploy_wait_time') || '60'; // Default wait time is 60 minutes
  
  //Login to Org
  sfdx.login(cert,login);

  //Deply/Checkonly to Org
  sfdx.deploy(deploy);
  
  //Destructive deploy
  sfdx.destructiveDeploy(deploy);

  //Executes data factory script
  sfdx.dataFactory(deploy);
  
} catch (error) {
  core.setFailed(error.message);
}



/***/ }),

/***/ 572:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {

const core = __nccwpck_require__(254)
const { spawnSync } = __nccwpck_require__(129);

module.exports.run = function(command, args) {
    var extraParams = {};
    
    //extraParams.shell = true;
    //extraParams.cwd = process.cwd();
    //extraParams.env = process.env;
    //extraParams.stdio = [process.stdin, process.stdout , process.stderr];
    extraParams.encoding = 'utf-8';
    extraParams.maxBuffer = 1024 * 1024 * 10

    var spawn = spawnSync(command, args, extraParams);

    if (spawn.stdout) {
        
        core.info("Command executed: " + command)
        core.info("With the following args: " + args.toString());
        core.info("Having the following return: " + spawn.stdout.toString());
    }

    if (spawn.error !== undefined || spawn.status !== 0) {
        var errorMessage = '';
        if (spawn.error !== undefined) {
            errorMessage = spawn.error;
        } 
        
        if (spawn.stderr !== undefined) {
            errorMessage += " " + spawn.stderr.toString();
        }
        core.error(errorMessage);
        throw Error(errorMessage);
    } 
}

/***/ }),

/***/ 826:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {

const core = __nccwpck_require__(254)
const execCommand = __nccwpck_require__(572);

var fnInstallSFDX = function(){
    core.info('=== Downloading and installing SFDX cli ===');
    execCommand.run('wget', ['https://developer.salesforce.com/media/salesforce-cli/sfdx-linux-amd64.tar.xz']);
    execCommand.run('mkdir', ['-p', 'sfdx-cli']);
    execCommand.run('tar', ['xJf', 'sfdx-linux-amd64.tar.xz', '-C', 'sfdx-cli', '--strip-components', '1']);
    execCommand.run('./sfdx-cli/install', []);
    core.info('=== SFDX cli installed ===');
};

module.exports.install = function(command, args) {
    //Installs Salesforce DX CLI
    fnInstallSFDX(); 

};


/***/ }),

/***/ 626:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {

const core = __nccwpck_require__(254)
const execCommand = __nccwpck_require__(572);
const fs = __nccwpck_require__(747);
const xml2js = __nccwpck_require__(431);

let getApexTestClass = function(manifestpath, classesPath, defaultTestClass){
    core.info("=== getApexTestClass ===");
    var parser = new xml2js.Parser();
    var typeTmp = null;
    var classes = null;
    var classNameTmp = null;
    var testClasses = [];
    var xml = fs.readFileSync(manifestpath, "utf8");
    var fileContentTmp = null;

    parser.parseString(xml, function (err, result) {
        for(var i in result.Package.types){
            typeTmp = result.Package.types[i];
            if("ApexClass" === typeTmp.name[0]){
                classes = typeTmp.members;
            }
        }
    });

    if(classes){
        for(var i = 0; i < classes.length; i++){
            classNameTmp = classes[i];
            fileContentTmp = fs.readFileSync(classesPath+"/"+classNameTmp+".cls", "utf8");
            if(fileContentTmp.toLowerCase().includes("@istest")){
                testClasses.push(classNameTmp);
            }
        }
    }else{
        if(defaultTestClass){
            testClasses.push(defaultTestClass);
        }
        
    }
    
    return testClasses.join(",");
}

let login = function (cert, login){
    core.info("=== login ===");
    core.debug('=== Decrypting certificate');
    execCommand.run('openssl', ['enc', '-nosalt', '-aes-256-cbc', '-d', '-in', cert.certificatePath, '-out', 'server.key', '-base64', '-K', cert.decryptionKey, '-iv', cert.decryptionIV]);

    core.info('==== Authenticating in the target org');
    const instanceurl = login.orgType === 'sandbox' ? 'https://test.salesforce.com' : 'https://login.salesforce.com';
    core.info('Instance URL: ' + instanceurl);
    execCommand.run('sfdx', ['force:auth:jwt:grant', '--instanceurl', instanceurl, '--clientid', login.clientId, '--jwtkeyfile', 'server.key', '--username', login.username, '--setalias', 'sfdc']);
};

let deploy = function (deploy){
    core.info("=== deploy ===");

    var manifestsArray = deploy.manifestToDeploy.split(",");
    var manifestTmp;
    var testClassesTmp;

    for(var i = 0; i < manifestsArray.length; i++){
        manifestTmp = manifestsArray[i];

        var argsDeploy = ['force:source:deploy', '--wait', deploy.deployWaitTime, '--manifest', manifestTmp, '--targetusername', 'sfdc', '--json'];

        if(deploy.checkonly){
            core.info("===== CHECH ONLY ====");
            argsDeploy.push('--checkonly');
        }

        if(deploy.testlevel == "RunSpecifiedTests"){
            testClassesTmp = getApexTestClass(manifestTmp, deploy.defaultSourcePath+'/classes', deploy.defaultTestClass);

            core.info("las clases son : "  + testClassesTmp);
            
            if(testClassesTmp){
                argsDeploy.push("--testlevel");
                argsDeploy.push(deploy.testlevel);
    
                argsDeploy.push("--runtests");
                argsDeploy.push(testClassesTmp);
            }else{
                argsDeploy.push("--testlevel");
                argsDeploy.push("RunLocalTests");
            }
        }else{
            argsDeploy.push("--testlevel");
            argsDeploy.push(deploy.testlevel);
        }

        execCommand.run('sfdx', argsDeploy);
    }
};

let destructiveDeploy = function (deploy){
    core.info("=== destructiveDeploy ===");
    if (deploy.destructivePath !== null && deploy.destructivePath !== '') {
        core.info('=== Applying destructive changes ===')
        var argsDestructive = ['force:mdapi:deploy', '-d', deploy.destructivePath, '-u', 'sfdc', '--wait', deploy.deployWaitTime, '-g', '--json'];
        if (deploy.checkonly) {
            argsDestructive.push('--checkonly');
        }
        execCommand.run('sfdx', argsDestructive);
    }
};

let dataFactory = function (deploy){
    core.info("=== dataFactory ===");
    if (deploy.dataFactory  && !deploy.checkonly) {
        core.info('Executing data factory');
        execCommand.run('sfdx', ['force:apex:execute', '-f', deploy.dataFactory, '-u', 'sfdc']);
    }
};


module.exports.deploy = deploy;
module.exports.login = login;
module.exports.destructiveDeploy = destructiveDeploy;
module.exports.dataFactory = dataFactory;

/***/ }),

/***/ 254:
/***/ ((module) => {

module.exports = eval("require")("@actions/core");


/***/ }),

/***/ 388:
/***/ ((module) => {

module.exports = eval("require")("@actions/github");


/***/ }),

/***/ 355:
/***/ ((module) => {

module.exports = eval("require")("properties-reader");


/***/ }),

/***/ 431:
/***/ ((module) => {

module.exports = eval("require")("xml2js");


/***/ }),

/***/ 129:
/***/ ((module) => {

"use strict";
module.exports = require("child_process");;

/***/ }),

/***/ 747:
/***/ ((module) => {

"use strict";
module.exports = require("fs");;

/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __nccwpck_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		if(__webpack_module_cache__[moduleId]) {
/******/ 			return __webpack_module_cache__[moduleId].exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		var threw = true;
/******/ 		try {
/******/ 			__webpack_modules__[moduleId](module, module.exports, __nccwpck_require__);
/******/ 			threw = false;
/******/ 		} finally {
/******/ 			if(threw) delete __webpack_module_cache__[moduleId];
/******/ 		}
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/compat */
/******/ 	
/******/ 	__nccwpck_require__.ab = __dirname + "/";/************************************************************************/
/******/ 	// module exports must be returned from runtime so entry inlining is disabled
/******/ 	// startup
/******/ 	// Load entry module and return exports
/******/ 	return __nccwpck_require__(920);
/******/ })()
;