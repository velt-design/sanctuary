import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const worker=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const source=path.resolve(worker,'../../packages/studio-documents/assets/fonts');
const target=path.join(worker,'dist/assets/fonts');fs.mkdirSync(target,{recursive:true});
for(const name of ['Inter-Regular.ttf','Inter-Medium.ttf','Inter-SemiBold.ttf','Inter-LICENSE.txt'])fs.copyFileSync(path.join(source,name),path.join(target,name));
const notices=path.join(worker,'dist/licenses');fs.mkdirSync(notices,{recursive:true});
fs.copyFileSync(path.resolve(worker,'../../packages/studio-documents/vendor/README.md'),path.join(notices,'fontkit-README.md'));
