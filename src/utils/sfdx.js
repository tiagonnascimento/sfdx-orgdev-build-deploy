const core = require('@actions/core')
const path = require('path');
const execCommand = require('./exec-command.js');
const fs = require('fs');
const xml2js = require('xml2js');

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

let getMetadataTypes = function(manifestsFiles, sfdxRootFolder){
    core.info("=== getManifestTypes ===");
    var parser = new xml2js.Parser();
    var type = null;
    var metadataTypes = [];

    for(var f = 0; f < manifestsFiles.length; f++){
        var manifestFile = sfdxRootFolder ? path.join(sfdxRootFolder, manifestsFiles[f]) : manifestsFiles[f];

        var xml = fs.readFileSync(manifestFile, "utf8");

        parser.parseString(xml, function (err, result) {
            for(var i in result.Package.types){
                type = result.Package.types[i];
                for(var j = 0; j < type.members.length; j++){
                    member = type.members[j];
                    if (member == "*") {
                        metadataTypes.push(type.name[0]);
                    } else {
                        metadataTypes.push(type.name[0] + ":" + member);
                    }
                }
            }
        });
    }

    return metadataTypes.join(",");
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
    var sfdxRootFolder = deploy.sfdxRootFolder;
    
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
            testClassesTmp = getApexTestClass(
                sfdxRootFolder ? path.join(sfdxRootFolder, manifestTmp) : manifestTmp, 
                sfdxRootFolder ? path.join(sfdxRootFolder, deploy.defaultSourcePath, 'classes') : path.join(deploy.defaultSourcePath, 'classes'),
                deploy.defaultTestClass);

            core.info("classes are : "  + testClassesTmp);
            
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

        execCommand.run('sfdx', argsDeploy, sfdxRootFolder);
    }
};

let retrieve = function (retrieveArgs){
    core.info("=== retrieve ===");

    var manifestsFiles = retrieveArgs.manifestToRetrieve.split(",");
    var sfdxRootFolder = retrieveArgs.sfdxRootFolder;
    
    var metadataTypes = getMetadataTypes(manifestsFiles, sfdxRootFolder);
    core.info(`metadata: ${metadataTypes}`);

    var commandArgs = ['force:source:retrieve', '--wait', retrieveArgs.deployWaitTime, '--metadata', metadataTypes, '--targetusername', 'sfdc', '--json', '--loglevel', 'INFO'];

    execCommand.run('sfdx', commandArgs, sfdxRootFolder);
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

const createSandbox = function (createSandboxArgs){
	core.info("=== createSandbox ===");
	var commandArgs = ['force:org:create', '-t', 'sandbox', 'sandboxName='+cloneArgs.sandboxName, 'licenseType=Developer', '-u', 'sfdc', '--json', '--loglevel', 'INFO']; //-u is necessary?
	execCommand.run('sfdx', commandArgs);
}

module.exports.deploy = deploy;
module.exports.login = login;
module.exports.destructiveDeploy = destructiveDeploy;
module.exports.dataFactory = dataFactory;
module.exports.retrieve = retrieve;
module.exports.createSandbox = createSandbox;