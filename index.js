const OpenShiftClient = require('./lib/index.js')
//const OpenShiftClient = require('openshift-client');

// Watch Deployments
const oapi = new OpenShiftClient.OApi(OpenShiftClient.config.fromKubeconfig());
const streamDC = oapi.deploymentconfigs.get({ qs: { watch: true,labelSelector: 'istio=true' } });
const JSONStream = require('json-stream');
const jsonStreamDC = new JSONStream();
streamDC.pipe(jsonStreamDC);


const initPatch=[{"name":"init","image":"docker.io/istio/init:0.1","args":["-p","15001","-u","1337"],"resources":{},"imagePullPolicy":"Always","securityContext":{"capabilities":{"add":["NET_ADMIN"]}}},{"name":"enable-core-dump","image":"alpine","command":["/bin/sh"],"args":["-c","sysctl -w kernel.core_pattern=/tmp/core.%e.%p.%t \u0026\u0026 ulimit -c unlimited"],"resources":{},"imagePullPolicy":"Always","securityContext":{"privileged":true}}];

const dcPatch=
{
      "name": "proxy",
      "image": "docker.io/istio/proxy_debug:0.1",
      "imagePullPolicy": "Always",
      "resources": {},
      "securityContext": {
         "runAsUser": 1337
      },
      "args": [
         "proxy",
         "sidecar",
         "-v",
         "2"
      ],
      "env": [
         {
            "name": "POD_NAME",
            "valueFrom": {
               "fieldRef": {
                  "fieldPath": "metadata.name"
               }
            }
         },
         {
            "name": "POD_NAMESPACE",
            "valueFrom": {
               "fieldRef": {
                  "fieldPath": "metadata.namespace"
               }
            }
         },
         {
            "name": "POD_IP",
            "valueFrom": {
               "fieldRef": {
                  "fieldPath": "status.podIP"
               }
            }
         }
      ]
}

jsonStreamDC.on('data', object => {
	console.log(object.type);
	if(object.type=='ADDED'){
		console.log(initPatch);
		object.object.spec.template.metadata.annotations["pod.beta.kubernetes.io/init-containers"]=JSON.stringify(initPatch);
		object.object.spec.template.spec.containers.push(dcPatch);
		console.log(JSON.stringify(object.object, null, 2));
		setTimeout(function(){
			oapi.namespaces.deploymentconfigs(object.object.metadata.name).patch({
				body: object.object
			},function(err,msg){
				console.log(err,msg);
			});
		},500);
	}
   //console.log('DC:', JSON.stringify(object, null, 2));
});



