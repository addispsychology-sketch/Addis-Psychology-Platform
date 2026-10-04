import {createRequire} from 'node:module';
process.loadEnvFile('.env.integration.local');
process.loadEnvFile('.env.local');
process.argv=['node','next','dev','--port','3001'];
createRequire(import.meta.url)('next/dist/bin/next');
