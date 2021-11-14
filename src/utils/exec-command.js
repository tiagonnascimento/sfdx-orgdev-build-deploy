const core = require('@actions/core')
const { spawnSync } = require('child_process');
const fs = require('fs');

const returnTypes = {
    LOGGED: 'logged',
    NOTFOUND: 'not found',
    PROCESSING: 'processing'
}

const getErrorMessage = function(spawn) {
    let errorMessage = '';
    if (spawn.error !== undefined) {
        errorMessage = spawn.error;
    } 
    if (spawn.stderr) {
        errorMessage += " " + spawn.stderr.toString();
    }
    return errorMessage;
}

const outputMessage = function(message, type, outputStdout) {
    let fileName = './output.txt';
    let fileFlags = {flag: 'w'};

    if (type == 'error') {
        core.error(message);
    } else {
        if (type != 'stdout' || outputStdout){
            core.info(message);
        }
    }
    fs.writeFileSync(fileName,message,fileFlags);
}

module.exports.returnTypes = returnTypes;
module.exports.run = function(command, args, workingFolder = null, process = null, outputStdout = true) {
    var extraParams = {};
    
    //extraParams.shell = true;
    //extraParams.env = process.env;
    //extraParams.stdio = [process.stdin, process.stdout , process.stderr];
    if (workingFolder) {
        extraParams.cwd = workingFolder;
    }
    extraParams.encoding = 'utf-8';
    extraParams.maxBuffer = 1024 * 1024 * 10

    var spawn = spawnSync(command, args, extraParams);

    if (process === 'sfdxIsInstalled') {
        if (spawn.error && spawn.error.code === 'ENOENT') {
            return false;
        } else if (spawn.stdout) {
            outputMessage(spawn.stdout);
            return true;
        }
    }

    if (spawn.stdout) {
        
        outputMessage(spawn.stdout.toString(),'stdout', outputStdout );

        switch (process) {
            case 'authInSandbox':
                if (spawn.status == 0) {
                    return returnTypes.LOGGED;
                } else {
                    const ret = JSON.parse(spawn.stdout);
                    switch (ret.name) {
                        case 'AuthInfoOverwriteError':
                            return returnTypes.LOGGED;
                        case 'SandboxProcessNotFoundBySandboxName':
                            return returnTypes.NOTFOUND;
                        case 'pollingTimeout':
                            if (ret.message == 'Sandbox status is Processing; timed out waiting for completion.') {
                                return returnTypes.PROCESSING;
                            }
                        default:
                            return getErrorMessage(spawn);
                    }
                }
                break;
            case 'deleteSandbox':
            case 'runTests':
                return spawn.status;
        }
    }

    if (spawn.error !== undefined || spawn.status !== 0) {
        const errorMessage = getErrorMessage(spawn);
        outputMessage(errorMessage, 'error', outputStdout);
        throw Error(errorMessage);
    }
}