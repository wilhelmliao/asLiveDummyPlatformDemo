const cluster = require('cluster');
const numCPUs = 1; //require('os').cpus().length;

const config = require('./config');

if (cluster.isMaster) {
  // Fork workers.
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  cluster.on('exit', (worker, code, signal) => {
  	console.log([
  	  'A process exit was triggered, most likely due to a failed database action',
  	  'NodeJS test server shutting down now'].join('\n'));
    process.exit(1);
  });
} else {
  global.CONFIG = config.config;
  global.RES    = config.res;

  // Task for forked worker
  require('./server');
}
