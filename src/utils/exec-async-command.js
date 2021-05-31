const core = require('@actions/core')
const { spawn } = require('child_process');

module.exports.run = function(command, args, workingFolder = null) {
    var extraParams = {};
    if (workingFolder) {
        extraParams.cwd = workingFolder;
    }
    extraParams.encoding = 'utf-8';
    extraParams.maxBuffer = 1024 * 1024 * 10

    var spawn = spawn(command, args, extraParams);

    spawn.stdout.on('data', (data) => {
        core.info("Command executed: " + command)
        core.info("With the following args: " + args.toString());
        core.info("Having the following return: " + data.toString());
    });

    spawn.stderr.on('data', (data) => {
        core.error(data.toString());
        throw Error(data.toString());
    });
}