const core = require('@actions/core')
const { spawnSync } = require('child_process');

module.exports.run = function(command, args) {
    var spawn = spawnSync(command, args);

    if (spawn.stdout !== undefined) {
        core.debug("Command executed: " + command)
        core.debug("With the following args: " + args.toString());
        core.debug("Having the following return: " + spawn.stdout.toString());
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