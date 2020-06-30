const core = require('@actions/core')
const execSync = require('child_process').execSync
var fs = require('fs');


module.exports.installSFDX = function (){
    var sfdxDir = 'sfdx-cli';
    core.debug("=== dependencies.installSFDX  ===");
    fs.access(sfdxDir, fs.constants.F_OK, (noExists) => {
        core.debug(`${sfdxDir} ${noExists ? 'El directorio no existe' : 'El directorio existe'}`);
        if(noExists){
            var download = 'wget https://developer.salesforce.com/media/salesforce-cli/sfdx-linux-amd64.tar.xz -P /tmp'
            var createDir = 'mkdir sfdx-cli'
            var unzip = 'tar xJf /tmp/sfdx-linux-amd64.tar.xz -C sfdx-cli --strip-components 1'
            var install = './sfdx-cli/install'
            var clean = 'rm -r ./sfdx-cli'
            execSync(download+' && '+createDir+' && '+unzip + ' && '+install+' && '+clean, function(error, stdout, stderr){
                if(error){
                    throw(stderr)
                }
                
                core.debug(stdout)
                core.debug("=== SFDX installed successfully ===");
            })
        }
        
    });
}