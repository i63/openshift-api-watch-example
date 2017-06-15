const OpenShiftClient = require('./lib/index.js')
//const OpenShiftClient = require('openshift-client');

// Watch Deployments
const streamDC = oapi.deploymentconfigs.get({ qs: { watch: true } });
const JSONStream = require('json-stream');
const jsonStreamDC = new JSONStream();
streamDC.pipe(jsonStreamDC);
jsonStreamDC.on('data', object => {
   console.log('DC:', JSON.stringify(object, null, 2));
});



