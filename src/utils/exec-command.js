const core = require('@actions/core')
const { spawnSync } = require('child_process');

module.exports.run = function(command, args, workingFolder = null) {
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
    }

    if (spawn.error !== undefined || spawn.status !== 0) {
        if (spawn.name === 'pollingTimeout')
            core.setOutput('processing','1');
        else {
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
    else {
        core.setOutput('processing','0');
    }
}