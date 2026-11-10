#!/usr/bin/env python3
"""Build a self-contained, signed offline APK. Signing secrets never leave .signing/."""
from pathlib import Path
import argparse,base64,hashlib,json,os,secrets,shutil,subprocess,zipfile
ROOT=Path(__file__).resolve().parent
parser=argparse.ArgumentParser();parser.add_argument('--toolchain',type=Path,default=ROOT/'.tools');args=parser.parse_args();TOOLS=args.toolchain.resolve();TOOLS.mkdir(parents=True,exist_ok=True)
def run(command,cwd=ROOT,**kwargs):subprocess.run([str(x) for x in command],cwd=cwd,check=True,**kwargs)
def download(name,url,digest,extract=False):
 target=TOOLS/name
 if not target.exists():run(['curl','-fL','--retry','2','--max-time','180',url,'-o',target])
 if hashlib.sha256(target.read_bytes()).hexdigest()!=digest:raise RuntimeError('Integrity check failed: '+name)
 if extract:
  with zipfile.ZipFile(target) as z:
   for item in z.infolist():
    p=(TOOLS/item.filename).resolve()
    if not p.is_relative_to(TOOLS):raise RuntimeError('Unexpected archive path')
    z.extract(item,TOOLS);mode=item.external_attr>>16
    if mode:os.chmod(p,mode)
 return target
sdk=download('platform.zip','https://dl.google.com/android/repository/platform-35_r02.zip','0988cacad01b38a18a47bac14a0695f246bc76c1b06c0eeb8eb0dc825ab0c8e0',True)
download('build-tools.zip','https://dl.google.com/android/repository/build-tools_r35_linux.zip','bd3a4966912eb8b30ed0d00b0cda6b6543b949d5ffe00bea54c04c81e1561d88',True)
ecj=download('ecj.jar','https://repo.maven.apache.org/maven2/org/eclipse/jdt/ecj/3.39.0/ecj-3.39.0.jar','01f5a92ac19bb2b3bf85e295a68f2c73c264369109158b566ce9b490af982948')
web=ROOT/'web';build=ROOT/'native/build';tool=TOOLS/'android-15';android=TOOLS/'android-35/android.jar'
if not (web/'node_modules').exists():run(['npm','ci','--cache',ROOT/'.tools/npm-cache'],cwd=web)
run(['npm','run','build'],cwd=web)
for p in ['classes','dex']:
 shutil.rmtree(build/p,ignore_errors=True);(build/p).mkdir(parents=True,exist_ok=True)
assets=ROOT/'native/assets/www';shutil.rmtree(assets,ignore_errors=True);shutil.copytree(web/'dist',assets)
run([tool/'aapt2','compile','--dir',ROOT/'native/res','-o',build/'resources.zip'])
run([tool/'aapt2','link','-I',android,'--manifest',ROOT/'native/AndroidManifest.xml','-A',ROOT/'native/assets','-o',build/'resources.apk',build/'resources.zip'])
run(['java','-jar',ecj,'-1.8','-classpath',android,'-nowarn','-d',build/'classes',*sorted((ROOT/'native/src').rglob('*.java'))])
run([tool/'d8','--lib',android,'--min-api','26','--output',build/'dex',*sorted((build/'classes').rglob('*.class'))])
unsigned=build/'unsigned.apk';shutil.copy2(build/'resources.apk',unsigned)
with zipfile.ZipFile(unsigned,'a',compression=zipfile.ZIP_DEFLATED) as z:
 for p in sorted((build/'dex').glob('*.dex')):z.write(p,p.name)
run([tool/'zipalign','-P','16','-f','4',unsigned,build/'aligned.apk'])
private=ROOT/'.signing';private.mkdir(mode=0o700,exist_ok=True);private.chmod(0o700);password=private/'password';keystore=private/'rotago-release.p12'
if not password.exists():password.write_text(secrets.token_urlsafe(48));password.chmod(0o600)
if not keystore.exists():
 env=os.environ.copy();env['ROTAGO_SIGN_PASS']=password.read_text();r=subprocess.run(['keytool','-genkeypair','-keystore',str(keystore),'-storetype','PKCS12','-alias','rotago-release','-keyalg','RSA','-keysize','3072','-validity','10000','-dname','CN=RotaGo, O=RotaGo, C=BR','-storepass:env','ROTAGO_SIGN_PASS','-keypass:env','ROTAGO_SIGN_PASS'],env=env,capture_output=True)
 if r.returncode:raise RuntimeError('Failed to create signing identity')
 keystore.chmod(0o600)
release=ROOT/'release';release.mkdir(exist_ok=True);apk=release/'RotaGo-1.0.0.apk'
run([tool/'apksigner','sign','--ks',keystore,'--ks-key-alias','rotago-release','--ks-pass','file:'+str(password),'--out',apk,build/'aligned.apk'])
run([tool/'apksigner','verify','--verbose',apk]);run([tool/'zipalign','-c','-P','16','4',apk])
(release/'SHA256SUMS.txt').write_text(hashlib.sha256(apk.read_bytes()).hexdigest()+'  '+apk.name+'\n')
print('APK ready:',apk)
