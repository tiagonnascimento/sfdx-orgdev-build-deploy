const core = require('@actions/core');
const { spawnSync } = require('child_process');

try {
    const type = core.getInput('type');
    const certificate_path = core.getInput('certificate_path');
    const decryption_key = core.getInput('decryption_key');
    const decryption_iv = core.getInput('decryption_iv');
    const clientId = core.getInput('client_id');
    const username = core.getInput('username');
    const checkonly = core.getInput('checkonly');
    const destructive_path = core.getInput('destructive_path');
    const manifest_path = core.getInput('manifest_path');
    const data_factory = core.getInput('data_factory');

    console.log('Downloading and installing SFDX cli');
    spawnSync('wget', ['https://developer.salesforce.com/media/salesforce-cli/sfdx-linux-amd64.tar.xz'], { stdio: 'inherit'});
    spawnSync('mkdir', ['sfdx-cli'], { stdio: 'inherit'});
    spawnSync('tar', ['xJf', 'sfdx-linux-amd64.tar.xz', '-C', 'sfdx-cli', '--strip-components', '1']), { stdio: 'inherit'};
    spawnSync('./sfdx-cli/install', [], { stdio: 'inherit'});
    console.log('SFDX cli installed');
    console.log('Decrypting certificate');
    spawnSync('openssl', ['enc', '-nosalt', '-aes-256-cbc', '-d', '-in', certificate_path, '-out', 'server.key', '-base64', '-K', decryption_key, '-iv', decryption_iv], { stdio: 'inherit'});

    console.log('Authenticating in the target org');
    const instanceurl = type === 'sandbox' ? 'https://test.salesforce.com' : 'https://login.salesforce.com';
    console.log('Instance URL: ' + instanceurl);
    spawnSync('sfdx', ['force:auth:jwt:grant', '--instanceurl', instanceurl, '--clientid', clientId, '--jwtkeyfile', 'server.key', '--username', username, '--setalias', 'sfdc'], { stdio: 'inherit'});

    if (destructive_path !== null && destructive_path !== '') {
        console.log('Applying destructive changes')
        var argsDestructive = ['force:mdapi:deploy', '-d', destructive_path, '-u', 'sfdc', '--wait', '10', '-g'];
        if (checkonly) {
            argsDestructive.push('-c');
        }
        spawnSync('sfdx', argsDestructive, { stdio: 'inherit'});
    }

    console.log('Converting the source into metadata')
    spawnSync('sfdx', ['force:source:convert', '-r', 'force-app/', '-d', 'convertedapi', '-x', manifest_path], { stdio: 'inherit'});

    console.log('Deploy package');
    var argsDeploy = ['force:mdapi:deploy', '--wait', '10', '-d', 'convertedapi', '-u', 'sfdc', '--testlevel', 'RunLocalTests'];
    if (checkonly) {
        argsDeploy.push('-c');
    }
    spawnSync('sfdx', argsDeploy, { stdio: 'inherit'});

    if (data_factory !== null && data_factory !== '') {
        console.log('Executing data factory');
        const apex = spawnSync('sfdx', ['force:apex:execute', '-f', data_factory, '-u', 'sfdc'], { stdio: 'inherit'});
    }

} catch (error) {
    core.setFailed(error.message);
}