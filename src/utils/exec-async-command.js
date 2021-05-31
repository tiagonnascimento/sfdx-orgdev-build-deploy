const core = require('@actions/core')
const { spawn } = require('child_process');

module.exports.run = function(command, args, workingFolder = null) {
    const extraParams = {};
    if (workingFolder) {
        extraParams.cwd = workingFolder;
    }
    extraParams.encoding = 'utf-8';
    extraParams.maxBuffer = 1024 * 1024 * 10

    const ls = spawn(command, args, extraParams);

    ls.stdout.on('data', (data) => {
        core.info("Command executed: " + command)
        core.info("With the following args: " + args.toString());
        core.info("Having the following return: " + data.toString());
    });

    ls.stderr.on('data', (data) => {
        core.error(data.toString());
        throw Error(data.toString());
    });
}