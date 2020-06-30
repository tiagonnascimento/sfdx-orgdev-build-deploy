const core = require('@actions/core')
const execCommand = require('./exec-command.js');
const fs = require('fs');
const xml2js = require('xml2js');
const { ifError } = require('assert');


let getApexTestClass = function(manifestpath, classesPath, defaultTestClass){
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
        testClasses.push(defaultTestClass);
    }
    
    return testClasses.join(",");
}

/*

cert = {
    certificatePath : "",
    decryptionKey : "",
    decryptionIV : ""
}

login = {
    clientId : "",
    orgType : "",
    username : ""
}

**/

let login = function (cert, login){
    core.debug('=== Decrypting certificate');
    execCommand.run('openssl', ['enc', '-nosalt', '-aes-256-cbc', '-d', '-in', cert.certificatePath, '-out', 'server.key', '-base64', '-K', cert.decryptionKey, '-iv', cert.decryptionIV]);

    console.log('Authenticating in the target org');
    const instanceurl = login.orgType === 'sandbox' ? 'https://test.salesforce.com' : 'https://login.salesforce.com';
    console.log('Instance URL: ' + instanceurl);
    execCommand.run('sfdx', ['force:auth:jwt:grant', '--instanceurl', instanceurl, '--clientid', login.clientId, '--jwtkeyfile', 'server.key', '--username', login.username, '--setalias', 'sfdc']);
};

let deploy = function (deploy){
    var manifestsArray = deploy.manifestToDeploy.split(",");
    var manifestTmp;
    var testClassesTmp;

    for(var i = 0; i < manifestsArray.length; i++){
        manifestTmp = manifestsArray[i];
        testClassesTmp = getApexTestClass(manifestTmp, deploy.defaultClassesPath, deploy.defaultDefault);

        console.log("las clases son : "  + testClassesTmp);

        //var argsDeploy = ['force:mdapi:deploy', '--wait', '10', '-d', 'preconvertedapi', '-u', 'sfdc', '--testlevel', 'RunLocalTests', '--json'];
        var argsDeploy = ['force:source:deploy', '--wait', '10', '--manifest', manifestTmp, '--targetusername', 'sfdc', '--testlevel', 'RunLocalTests', '--json'];
        
        if(deploy.checkonly === 'true'){
            argsDeploy.push('--checkonly');
        }
        if(testClassesTmp){
            argsDeploy.push("--testlevel");
            argsDeploy.push("RunSpecifiedTests");

            argsDeploy.push("--runtests");
            argsDeploy.push(testClassesTmp);
        }

        execCommand.run('sfdx', argsDeploy);

    }
};



module.exports.deploy = deploy;
module.exports.login = login;


/*module.exports.login = function (cert, login){
 
    var generateCertCMD = "openssl  enc -nosalt -aes-256-cbc -d -in " + cert.certificatePath + " -out server.key -base64 -K " + cert.decryptionKey + " -iv " + cert.decryptionIV;
    var loginGranCMD;
    core.debug("=== Comando para generar certificado: " + generateCertCMD);
    exec(generateCertCMD, function(error, stdout, stderr){
        core.debug("error" + error);
        core.debug("stdout" + stdout);
        core.debug("stderr" + stderr);
        
        if(error){
            throw(stderr);
        }

        
    
        core.debug('Authenticating in the target org');
        const instanceurl = login.orgType === 'sandbox' ? 'https://test.salesforce.com' : 'https://login.salesforce.com';
        core.debug('Instance URL: ' + instanceurl);

        loginGranCMD = "sfdx force:auth:jwt:grant --instanceurl " + instanceurl + " --clientid " + login.clientId + " --jwtkeyfile server.key --username " + login.username+ " --setalias SFDC";
        core.debug('Grant command: ' + loginGranCMD);

        exec(generateCertCMD, function(error, stdout, stderr){
            core.debug("error" + error);
            core.debug("stdout" + stdout);
            core.debug("stderr" + stderr);
            if(error){
                throw(stderr);
            }

            core.debug("=== SFDX Login successfully ===");
            
        });
    });
}*/