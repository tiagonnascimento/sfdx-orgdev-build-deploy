const core = require('@actions/core');
const github = require('@actions/github');

try {
    const type = core.getInput('type');
    console.log('Type of deployment: ${type}!');

    const clientId = core.getInput('client_id');
    console.log('ClientId to be used to connect in the destionation org: ${clientId}');

    const username = core.getInput('username');
    console.log('Username to be used to connect in the destination org: ${username}');
  
} catch (error) {
    core.setFailed(error.message);
}