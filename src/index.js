const core = require('@actions/core');
const github = require('@actions/github');
var propertiesReader = require('properties-reader');
const dependencies = require('./utils/install-dependencies.js');
const sfdx = require('./utils/sfdx.js');

try {
  
  core.info("=== YOU SHOULD DO NOTHING ===");
 
  
} catch (error) {
  core.setFailed(error.message);
}

