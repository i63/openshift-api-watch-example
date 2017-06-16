const OpenShiftClient = require('openshift-client');
const Api = require('kubernetes-client');
const core = new Api.Core(Api.config.fromKubeconfig());
//const core = new Api.Core(Api.config.getInCluster());

// Watch Deployments
const oapi = new OpenShiftClient.OApi(OpenShiftClient.config.fromKubeconfig());
//const oapi = new OpenShiftClient.OApi(OpenShiftClient.config.getInCluster());

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
	//console.log(object.type);
	if(object.type=='ADDED'){
		//console.log(initPatch);
		object.object.spec.template.metadata.annotations["pod.beta.kubernetes.io/init-containers"]=JSON.stringify(initPatch);
		object.object.spec.template.spec.containers.push(dcPatch);
		//console.log(JSON.stringify(object.object, null, 2));

		//update Deployment Config	w/ side card	
		oapi.ns(object.object.metadata.namespace).deploymentconfigs(object.object.metadata.name).patch({
			body: object.object
		},function(err,msg){
			console.log('Patched DC '+object.object.metadata.namespace+"/"+object.object.metadata.name);
			//update service with http
	
			core.ns(object.object.metadata.namespace).services(object.object.metadata.name).get(function(err,obj){
				console.log(err,obj);	
				obj.spec.ports[0].name = 'http-'+obj.spec.ports[0].name;
				core.ns(object.object.metadata.namespace).services(object.object.metadata.name).patch({
					body: obj
				},function(err,msg){
					console.log(err,msg);
					console.log('service updated');
				});
			});
		});


	}
   //console.log('DC:', JSON.stringify(object, null, 2));
});



