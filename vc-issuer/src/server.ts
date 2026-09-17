import {buildApplication} from './application.js';
import {loadConfig} from './config.js';

const config = loadConfig();
const app = await buildApplication({config});

try {
  await app.listen({port: config.port, host: config.host});
} catch(error) {
  app.log.error({error: error instanceof Error ? error.message : 'unknown'},
    'Server failed to start.');
  process.exitCode = 1;
}
