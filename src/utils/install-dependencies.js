const core = require('@actions/core')
const execCommand = require('./exec-command.js');

var fnInstallSFDX = function(){
    core.info('=== Downloading and installing SFDX cli ===');
    //execCommand.run('wget', ['https://developer.salesforce.com/media/salesforce-cli/sfdx-cli/channels/stable/sfdx-cli-v7.72.0-697e9faee2-linux-x64.tar.xz']);
    execCommand.run('wget', ['https://developer.salesforce.com/media/salesforce-cli/sfdx/channels/stable/sfdx-linux-x64.tar.gz']);
    execCommand.run('mkdir', ['-p', 'sfdx-cli']);
    //execCommand.run('tar', ['xJf', 'sfdx-cli-v7.72.0-697e9faee2-linux-x64.tar.xz', '-C', 'sfdx-cli', '--strip-components', '1']);
    execCommand.run('tar', ['xJf', 'sfdx-linux-amd64.tar.xz', '-C', 'sfdx-cli', '--strip-components', '1']);
    execCommand.run('./sfdx-cli/install', []);
    core.info('=== SFDX cli installed ===');
};

module.exports.install = function(command, args) {
    //Installs Salesforce DX CLI
    fnInstallSFDX(); 

};
