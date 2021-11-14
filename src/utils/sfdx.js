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

const convertPackage = function(packageFolder, manifestFile, sfdxRootFolder){
    core.info("=== convert ===");

    const parser = new xml2js.Parser({ attrkey: "attr" });

    // you can read it asynchronously also
    let xml_string = fs.readFileSync(sfdxRootFolder + '/' + manifestFile, "utf8");
    let ret;
    parser.parseString(xml_string, function(error, result) {
            if (error !== null) {
                ret = 1;
                core.error('Error parsing xml package');
                core.error(error);
            } else if (result.Package.types == undefined){
                ret = 2;
            } else {
                ret = 3;
                var argsDeploy = ['force:source:convert', '--rootdir', './', '--outputdir', packageFolder, '-x', manifestFile, '--json'];
                execCommand.run('sfdx',argsDeploy, sfdxRootFolder);
        }
    });
    return ret;
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
    let manifestFile = deploy.packageFolder + 'package.xml';
    //if package is empty, deploy anyway as can have destructive changes
    if (convertPackage(deploy.packageFolder, manifestFile, deploy.sfdxRootFolder) != 1){
        var argsDeploy = ['force:mdapi:deploy', '--wait', deploy.deployWaitTime, '-d', deploy.packageFolder, '--targetusername', deploy.username, '--json'];
        if(deploy.checkonly){
            core.info("===== CHECK ONLY ====");
            argsDeploy.push('--checkonly');
        }
        if(deploy.ignoreWarnings){
            argsDeploy.push('--ignorewarnings');
        }
        setTestArgs(deploy, argsDeploy, manifestFile);
        execCommand.run('sfdx', argsDeploy, deploy.sfdxRootFolder, null, deploy.outputStdout);
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

let dumpChanges = function(dumpChangesArgs){
    console.info("===dump changes===");
    var sfdxRootFolder = dumpChangesArgs.sfdxRootFolder;
    const oneDayOffset = (24*60*60*1000) * 1;
    let dt = new Date() - oneDayOffset; //24 hour before
    const dtString = new Date(dt).toISOString();
    let query = "SELECT CreatedDate, CreatedBy.Name, ResponsibleNamespacePrefix, Action,CreatedById,DelegateUser,Display,Id,Section FROM SetupAuditTrail WHERE action not in ('suOrgAdminLogout' , 'suOrgAdminLogin') and createdDate > " + dtString;
    core.info(query);
    var commandArgs = ['force:data:soql:query', '-q', query, '--resultformat' ,'csv', '--targetusername', 'sfdc'];
    execCommand.run('sfdx', commandArgs, sfdxRootFolder, null, true );
}

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
    deploy(args)
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

const runTests = function(args) {
    core.info("=== runTests ===");
    const commandArgs = ['force:apex:test:run', '-u', args.username, '-w',args.deployWaitTime,'-r','json','--verbose'];
    if (args.testsToRun) {
        commandArgs.push('-n');
        commandArgs.push(args.testsToRun);
    }
	const execReturn = execCommand.run('sfdx', commandArgs, null, 'runTests', args.outputStdout);
    core.setOutput('status',execReturn);
}

module.exports.login = login;
module.exports.deployer = deployer;
module.exports.retrieve = retrieve;
module.exports.dumpChanges = dumpChanges;
module.exports.authInSandbox = authInSandbox;
module.exports.createSandbox = createSandbox;
module.exports.deleteSandbox = deleteSandbox;
module.exports.runTests = runTests;