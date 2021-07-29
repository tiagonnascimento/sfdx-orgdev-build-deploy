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
                    let member = type.members[j];
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

const setTestArgs = function (deploy, argsDeploy, manifestFile){
    if(deploy.testlevel == "RunSpecifiedTests"){
        let sfdxRootFolder = deploy.sfdxRootFolder;
        const testClassesTmp = getApexTestClass(
            sfdxRootFolder ? path.join(sfdxRootFolder, manifestFile) : manifestFile, 
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

    for(var i = 0; i < manifestsArray.length; i++){
        manifestTmp = manifestsArray[i];

        var argsDeploy = ['force:mdapi:deploy', '--wait', deploy.deployWaitTime, '--manifest', manifestTmp, '--targetusername', deploy.username, '--json'];

        if(deploy.checkonly){
            core.info("===== CHECK ONLY ====");
            argsDeploy.push('--checkonly');
        }
        setTestArgs(deploy, argsDeploy, manifestTmp);
        execCommand.run('sfdx', argsDeploy, deploy.sfdxRootFolder);
    }
};

let deployAllTogether = function (deploy){
    core.info("=== deploy ===");

    var argsDeploy = ['force:mdapi:deploy', '--wait', deploy.deployWaitTime, '-d', deploy.packageFolder, '--targetusername', deploy.username, '-g', '--json'];
    if(deploy.checkonly){
        core.info("===== CHECK ONLY ====");
        argsDeploy.push('--checkonly');
    }
    setTestArgs(deploy, argsDeploy, deploy.packageFolder + 'package.xml');
    execCommand.run('sfdx', argsDeploy, deploy.sfdxRootFolder);
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
        var argsDestructive = ['force:mdapi:deploy', '-d', deploy.destructivePath, '-u', deploy.username, '--wait', deploy.deployWaitTime, '-g', '--json'];
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
        execCommand.run('sfdx', ['force:apex:execute', '-f', deploy.dataFactory, '-u', deploy.username]);
    }
};

const deployer = function (args){
    if (args.sandbox) {
        args.checkonly = false;
        args.testlevel = 'NoTestRun';
    }

    //Deploy/Checkonly to Org
    if (args.packageFolder){
        deployAllTogether(args)
    } else {
        deploy(args);
        destructiveDeploy(args);
    }
    dataFactory(args);

    if (!args.sandbox && !args.checkonly){
        core.setOutput('deployInProd','1');
    }
}

const authInSandbox = function (args){
    core.info("=== authInSandbox ===");
    const alias = 'sfdc.' + args.sandboxName.toLowerCase();
    const commandArgs = ['force:org:status', '-n', args.sandboxName, '-u', 'sfdc', '--json', '-w', '2', '--setalias', alias];
	const execReturn = execCommand.run('sfdx', commandArgs, null,'authInSandbox');

    if (args.deployInProd && execReturn != execCommand.returnTypes.LOGGED) {
        return undefined;
    }

    switch(execReturn) {
        case execCommand.returnTypes.LOGGED:
            return alias;
        case execCommand.returnTypes.NOTFOUND:
            if (args.sandboxCreationType == 'new') {
                createSandbox(args,alias);
            } else {
                cloneSandbox(args,alias);
            }
            core.setOutput('sandboxCreated', '1');
            return alias;
        case execCommand.returnTypes.PROCESSING:
            const errorMessage = "Sandbox is processing, can't deploy now into sandbox.";
            core.error(errorMessage);
            throw Error(errorMessage);
        default:
            throw Error(execReturn);
    }
}

const createSandbox = function (args,alias = null){
	core.info("=== createSandbox ===");
	const commandArgs = ['force:org:create', '-t', 'sandbox', 'sandboxName='+args.sandboxName, 'licenseType=Developer', '-u', 'sfdc', '--json', '-w', '60'];
    if (alias != null){
        commandArgs.push('--setalias', alias);
    }
	execCommand.run('sfdx', commandArgs);
}

const cloneSandbox = function (args,alias = null){
	core.info("=== cloneSandbox ===");
	const commandArgs = ['force:org:clone', '-t', 'sandbox', 'sandboxName='+args.sandboxName, 'SourceSandboxName='+args.sourceSandboxName, '-u', 'sfdc', '--json', '-w', '60'];
    if (alias != null){
        commandArgs.push('--setalias', alias);
    }
	execCommand.run('sfdx', commandArgs);
}

const deleteSandbox = function (username){
	core.info("=== deleteSandbox ===");
	const commandArgs = ['force:org:delete', '-u', username, '--json','-p'];
	const execReturn = execCommand.run('sfdx', commandArgs, null, 'deleteSandbox');
    core.setOutput('errorDeletingSandbox',execReturn);
}

module.exports.login = login;
module.exports.deployer = deployer;
module.exports.retrieve = retrieve;
module.exports.authInSandbox = authInSandbox;
module.exports.createSandbox = createSandbox;
module.exports.deleteSandbox = deleteSandbox;