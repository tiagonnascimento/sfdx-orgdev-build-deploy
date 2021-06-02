const core = require('@actions/core')
const { spawnSync } = require('child_process');

const returnTypes = {
    LOGGED: 'logged',
    NOTFOUND: 'not found',
    PROCESSING: 'processing'
}

module.exports.returnTypes = returnTypes;
module.exports.run = function(command, args, workingFolder = null, process = null) {
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

    if (spawn.stdout) {
        core.info("Command executed: " + command)
        core.info("With the following args: " + args.toString());
        core.info("Having the following return: " + spawn.stdout.toString());

        if (process == 'checkSandbox') {
            if (spawn.status == 0) {
                return returnTypes.LOGGED;
            } else {
                try {
                    const ret = JSON.parse(spawn.stdout);
                    switch (ret.name) {
                        case 'AuthInfoOverwriteError':
                            return returnTypes.LOGGED;
                        case 'SandboxProcessNotFoundBySandboxName':
                            return returnTypes.NOTFOUND;
                        case 'pollingTimeout':
                            if (ret.message == 'Sandbox status is Processing; timed out waiting for completion.')
                                return returnTypes.PROCESSING;
                    }
                } catch {}
            }
        }
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