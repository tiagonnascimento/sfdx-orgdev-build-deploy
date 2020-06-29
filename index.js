const core = require('@actions/core');
const { spawnSync } = require('child_process');

function executeCommand(command, args) {

    var spawn = spawnSync(command, args);

    if (spawn.stdout !== undefined) {
        console.log("Command executed: " + command)
        console.log("With the following args: " + args.toString());
        console.log("Having the following return: " + spawn.stdout.toString());
    }

    if (spawn.error !== undefined || spawn.status !== 0) {
        var errorMessage = '';
        if (spawn.error !== undefined) {
            errorMessage = spawn.error;
        } 
        
        if (spawn.stderr !== undefined) {
            errorMessage += " " + spawn.stderr.toString();
        }
        console.log(errorMessage);
        throw Error(errorMessage);
    } 
}

try {

    const type = core.getInput('type');
    const certificate_path = core.getInput('certificate_path');
    const decryption_key = core.getInput('decryption_key');
    const decryption_iv = core.getInput('decryption_iv');
    const clientId = core.getInput('client_id');
    const username = core.getInput('username');
    const checkonly = core.getInput('checkonly');
    const pre_manifest_path = core.getInput('pre_manifest_path');
    const destructive_path = core.getInput('destructive_path');
    const manifest_path = core.getInput('manifest_path');
    const data_factory = core.getInput('data_factory');

    console.log('Downloading and installing SFDX cli');
    executeCommand('wget', ['https://developer.salesforce.com/media/salesforce-cli/sfdx-linux-amd64.tar.xz']);
    executeCommand('mkdir', ['-p', 'sfdx-cli']);
    executeCommand('tar', ['xJf', 'sfdx-linux-amd64.tar.xz', '-C', 'sfdx-cli', '--strip-components', '1']);
    executeCommand('./sfdx-cli/install', []);
    console.log('SFDX cli installed');
    console.log('Decrypting certificate');
    executeCommand('openssl', ['enc', '-nosalt', '-aes-256-cbc', '-d', '-in', certificate_path, '-out', 'server.key', '-base64', '-K', decryption_key, '-iv', decryption_iv]);

    console.log('Authenticating in the target org');
    const instanceurl = type === 'sandbox' ? 'https://test.salesforce.com' : 'https://login.salesforce.com';
    console.log('Instance URL: ' + instanceurl);
    executeCommand('sfdx', ['force:auth:jwt:grant', '--instanceurl', instanceurl, '--clientid', clientId, '--jwtkeyfile', 'server.key', '--username', username, '--setalias', 'sfdc']);

    if (pre_manifest_path !== null && pre_manifest_path !== '') {
        console.log('Converting the source into metadata for the pre-deployment');
        executeCommand('sfdx', ['force:source:convert', '-r', 'force-app/', '-d', 'preconvertedapi', '-x', pre_manifest_path]);
    
        console.log('Deploy pre-package');
        var argsDeploy = ['force:mdapi:deploy', '--wait', '10', '-d', 'preconvertedapi', '-u', 'sfdc', '--testlevel', 'RunLocalTests', '--json'];
        if (checkonly === 'true') {
            argsDeploy.push('-c');
        }
        executeCommand('sfdx', argsDeploy);
    }


    if (destructive_path !== null && destructive_path !== '') {
        console.log('Applying destructive changes')
        var argsDestructive = ['force:mdapi:deploy', '-d', destructive_path, '-u', 'sfdc', '--wait', '10', '-g', '--json'];
        if (checkonly === 'true') {
            argsDestructive.push('-c');
        }
        executeCommand('sfdx', argsDestructive);
    }

    console.log('Converting the source into metadata')
    executeCommand('sfdx', ['force:source:convert', '-r', 'force-app/', '-d', 'convertedapi', '-x', manifest_path]);

    console.log('Deploy package');
    var argsDeploy = ['force:mdapi:deploy', '--wait', '10', '-d', 'convertedapi', '-u', 'sfdc', '--testlevel', 'RunLocalTests', '--json'];
    if (checkonly === 'true') {
        argsDeploy.push('-c');
    }
    executeCommand('sfdx', argsDeploy);

    if (data_factory !== null && data_factory !== '' && checkonly === 'false') {
        console.log('Executing data factory');
        const apex = executeCommand('sfdx', ['force:apex:execute', '-f', data_factory, '-u', 'sfdc']);
    }

} catch (error) {
    core.setFailed(error.message);
}