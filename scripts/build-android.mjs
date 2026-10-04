import { existsSync, mkdirSync, copyFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';
import { spawnSync } from 'node:child_process';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const android = join(root, 'android');
const bundledJava = '/Applications/Android Studio.app/Contents/jbr/Contents/Home';
const env = { ...process.env };
function javaVersion(home) {
  const executable = home ? join(home, 'bin', process.platform === 'win32' ? 'java.exe' : 'java') : 'java';
  const result = spawnSync(executable, ['-version'], { encoding: 'utf8' });
  const version = `${result.stderr ?? ''}${result.stdout ?? ''}`.match(/version "(\d+)/);
  return version ? Number(version[1]) : 0;
}
if (javaVersion(env.JAVA_HOME) < 21 && existsSync(bundledJava) && javaVersion(bundledJava) >= 21) {
  env.JAVA_HOME = bundledJava;
  console.log('Utilisation du JDK 21 intégré à Android Studio pour cette compilation.');
}
if (javaVersion(env.JAVA_HOME) < 21) {
  console.error('Capacitor Android demande un JDK 21. Définissez JAVA_HOME vers ce JDK.');
  process.exit(1);
}
if (!env.ANDROID_HOME && process.platform === 'darwin') env.ANDROID_HOME = join(homedir(), 'Library/Android/sdk');
const result = spawnSync(process.platform === 'win32' ? 'gradlew.bat' : './gradlew', ['assembleDebug', '--console=plain'], { cwd: android, env, stdio: 'inherit', shell: process.platform === 'win32' });
if (result.error) { console.error(result.error.message); process.exit(1); }
if (result.status !== 0) process.exit(result.status ?? 1);
const output = join(root, 'artifacts', 'find-it-debug.apk');
mkdirSync(dirname(output), { recursive: true });
copyFileSync(join(android, 'app/build/outputs/apk/debug/app-debug.apk'), output);
console.log(`\nAPK de test : ${output}\nCette version debug est destinée aux tests, pas à la publication sur Google Play.`);
